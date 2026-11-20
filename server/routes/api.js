import { Router } from 'express';
import http from 'http';
import { Employee } from '../models/Employee.js';
import { Fingerprint } from '../models/Fingerprint.js';
import { Order } from '../models/Order.js';
import { MealSlot } from '../models/MealSlot.js';
import { TransportUnit } from '../models/TransportUnit.js';
import { FoodTransport } from '../models/FoodTransport.js';
import { Feedback } from '../models/Feedback.js';
import { DailyCounter } from '../models/DailyCounter.js';
import { connectDB, getDbStatus } from '../config/db.js';

const router = Router();

// Ensure DB is connected (vital for serverless cold starts on Vercel)
router.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch {
    // continue, errors handled gracefully in endpoints
  }
  next();
});

// ============================================================================
// SYSTEM / DATABASE STATUS
// ============================================================================
router.get('/status', async (req, res) => {
  try {
    const status = getDbStatus();
    if (status.isConnected) {
      const [empCount, fpCount, orderCount, slotCount, transportCount, feedbackCount] = await Promise.all([
        Employee.countDocuments(),
        Fingerprint.countDocuments(),
        Order.countDocuments(),
        MealSlot.countDocuments(),
        FoodTransport.countDocuments(),
        Feedback.countDocuments(),
      ]);
      return res.json({
        ...status,
        counts: {
          employees: empCount,
          fingerprints: fpCount,
          orders: orderCount,
          mealSlots: slotCount,
          foodTransports: transportCount,
          feedbacks: feedbackCount,
        },
      });
    }
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 1. EMPLOYEES
// ============================================================================
router.get('/employees', async (req, res) => {
  try {
    const employees = await Employee.find({ is_active: { $ne: false } }).sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/employees', async (req, res) => {
  try {
    const { id, name, dept, role, photo_url, face_descriptor, confidence_score, subsidy_rate } = req.body;
    if (!id || !name) {
      return res.status(400).json({ error: 'ID and Name are required.' });
    }

    const cleanId = String(id).trim().toUpperCase();
    const existing = await Employee.findOne({ id: cleanId });
    if (existing) {
      return res.status(409).json({ error: `Employee with ID ${cleanId} already exists.` });
    }

    const employee = await Employee.create({
      id: cleanId,
      name: String(name).trim(),
      dept: dept || 'Employee',
      role: role || (dept?.toLowerCase().includes('staff') ? 'Staff' : 'Employee'),
      photo_url: photo_url || '',
      face_descriptor: face_descriptor || null,
      confidence_score: confidence_score ?? 0.98,
      subsidy_rate: subsidy_rate ?? 1.0,
      is_active: true,
    });

    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/employees/:id', async (req, res) => {
  try {
    const cleanId = String(req.params.id).trim().toUpperCase();
    const updateData = { ...req.body };
    if (updateData.id) {
      updateData.id = String(updateData.id).trim().toUpperCase();
    }

    const updated = await Employee.findOneAndUpdate(
      { id: cleanId },
      { $set: updateData },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Employee not found.' });
    }
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/employees/:id', async (req, res) => {
  try {
    const cleanId = String(req.params.id).trim().toUpperCase();
    await Employee.findOneAndDelete({ id: cleanId });
    await Fingerprint.findOneAndDelete({ employeeId: cleanId });
    res.json({ success: true, message: `Employee and fingerprint details for ${cleanId} permanently deleted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 2. ORDERS & DAILY TOKEN COUNTER
// ============================================================================
router.get('/orders', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 3000;
    const orders = await Order.find().sort({ timestamp: -1 }).limit(limit);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/orders/batch', async (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ error: 'Orders array is required.' });
    }

    // Atomic increment for daily token numbers if needed
    const today = new Date().toISOString().slice(0, 10);
    const counter = await DailyCounter.findOneAndUpdate(
      { counterDate: today },
      { $inc: { lastToken: orders.length } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    let startToken = counter.lastToken - orders.length + 1;

    const docsToInsert = orders.map((ord, idx) => ({
      ...ord,
      token: ord.token || (startToken + idx),
      status: ord.status || 'PRINTED',
      timestamp: ord.timestamp || Date.now(),
      dateStr: ord.dateStr || today,
    }));

    const inserted = await Order.insertMany(docsToInsert);
    res.status(201).json(inserted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/orders/:orderUuid/serve', async (req, res) => {
  try {
    const { orderUuid } = req.params;
    const order = await Order.findOne({ orderUuid });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.status === 'SERVED') {
      return res.status(409).json({
        type: 'DUPLICATE_CLAIM',
        order,
        message: `Meal was already served at ${order.servedAt}.`,
      });
    }

    const servedTimeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    order.status = 'SERVED';
    order.servedAt = servedTimeStr;
    await order.save();

    res.json({
      type: 'SUCCESS',
      order,
      message: 'Verified and served successfully.',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/orders/:orderUuid', async (req, res) => {
  try {
    const { orderUuid } = req.params;
    await Order.findOneAndDelete({ orderUuid });
    res.json({ success: true, message: `Order ${orderUuid} cancelled/deleted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 3. MEAL SLOTS
// ============================================================================
router.get('/meal-slots', async (req, res) => {
  try {
    const slots = await MealSlot.find().sort({ startTime: 1 });
    res.json(slots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/meal-slots', async (req, res) => {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: 'Slots array is required.' });
    }

    const operations = slots.map((slot) => ({
      updateOne: {
        filter: { name: slot.name },
        update: { $set: slot },
        upsert: true,
      },
    }));

    await MealSlot.bulkWrite(operations);
    const updated = await MealSlot.find().sort({ startTime: 1 });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 4. TRANSPORT UNITS & FOOD TRANSPORTS
// ============================================================================
router.get('/transport-units', async (req, res) => {
  try {
    const units = await TransportUnit.find().sort({ id: 1 });
    res.json(units);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/transport-units', async (req, res) => {
  try {
    const unit = await TransportUnit.create(req.body);
    res.status(201).json(unit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/transport-units/:id', async (req, res) => {
  try {
    await TransportUnit.findOneAndDelete({ id: req.params.id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/food-transports', async (req, res) => {
  try {
    const transports = await FoodTransport.find().sort({ timestamp: -1 });
    res.json(transports);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/food-transports', async (req, res) => {
  try {
    const record = await FoodTransport.create(req.body);
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/food-transports/:id', async (req, res) => {
  try {
    await FoodTransport.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 5. FEEDBACKS
// ============================================================================
router.get('/feedbacks', async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ timestamp: -1 });
    res.json(feedbacks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/feedbacks', async (req, res) => {
  try {
    const fb = await Feedback.create(req.body);
    res.status(201).json(fb);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/feedbacks/:id', async (req, res) => {
  try {
    await Feedback.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 6. FINGERPRINTS (Mantra MFS100 Biometric Store)
// ============================================================================
router.get('/fingerprints', async (req, res) => {
  try {
    const list = await Fingerprint.find({ isActive: true }).lean();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/fingerprints/:employeeId', async (req, res) => {
  try {
    const cleanId = String(req.params.employeeId).trim().toUpperCase();
    const fp = await Fingerprint.findOne({ employeeId: cleanId, isActive: true }).lean();
    if (!fp) {
      return res.status(404).json({ error: 'Fingerprint not found for employee' });
    }
    res.json(fp);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/fingerprints', async (req, res) => {
  try {
    const { employeeId, employeeName, dept, finger1, finger2, deviceModel } = req.body;
    if (!employeeId) {
      return res.status(400).json({ error: 'employeeId is required.' });
    }
    if (!finger1?.isoTemplate || !finger2?.isoTemplate) {
      return res.status(400).json({ error: 'Both Finger 1 and Finger 2 ISO templates are required.' });
    }

    const cleanId = String(employeeId).trim().toUpperCase();

    // 1. Prevent duplicate touch between Primary and Backup
    const f1Iso = finger1.isoTemplate || '';
    const f2Iso = finger2.isoTemplate || '';
    if (f1Iso === f2Iso || Math.abs(f1Iso.length - f2Iso.length) <= 25) {
      return res.status(400).json({
        error: 'Primary and Backup Touch cannot be the same. Please scan two different touches.'
      });
    }

    // 2. Prevent duplicate touch across all other registered personnel
    const existingRecords = await Fingerprint.find({
      employeeId: { $ne: cleanId },
      isActive: { $ne: false }
    });

    for (const rec of existingRecords) {
      const t1 = rec.finger1?.isoTemplate || '';
      const t2 = rec.finger2?.isoTemplate || '';

      const isF1Duplicate =
        (t1 && (f1Iso === t1 || Math.abs(f1Iso.length - t1.length) <= 30)) ||
        (t2 && (f1Iso === t2 || Math.abs(f1Iso.length - t2.length) <= 30));

      const isF2Duplicate =
        (t1 && (f2Iso === t1 || Math.abs(f2Iso.length - t1.length) <= 30)) ||
        (t2 && (f2Iso === t2 || Math.abs(f2Iso.length - t2.length) <= 30));

      if (isF1Duplicate || isF2Duplicate) {
        return res.status(409).json({
          error: `This touch ID is already registered to ${rec.employeeName || rec.employeeId} (${rec.employeeId})! Duplicate registration is not allowed.`
        });
      }
    }

    // Upsert fingerprint record for this employee
    const record = await Fingerprint.findOneAndUpdate(
      { employeeId: cleanId },
      {
        $set: {
          employeeId: cleanId,
          employeeName: employeeName || '',
          dept: dept || 'Employee',
          finger1: {
            fingerName: finger1.fingerName || 'Right Thumb',
            isoTemplate: finger1.isoTemplate,
            ansiTemplate: finger1.ansiTemplate || '',
            bitmapData: finger1.bitmapData || '',
            quality: finger1.quality || 0,
            samples: Array.isArray(finger1.samples) ? finger1.samples : [],
          },
          finger2: {
            fingerName: finger2.fingerName || 'Right Index',
            isoTemplate: finger2.isoTemplate,
            ansiTemplate: finger2.ansiTemplate || '',
            bitmapData: finger2.bitmapData || '',
            quality: finger2.quality || 0,
            samples: Array.isArray(finger2.samples) ? finger2.samples : [],
          },
          deviceModel: deviceModel || 'Mantra MFS100',
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/fingerprints/:employeeId', async (req, res) => {
  try {
    const cleanId = String(req.params.employeeId).trim().toUpperCase();
    await Fingerprint.findOneAndDelete({ employeeId: cleanId });
    res.json({ success: true, message: `Fingerprint for ${cleanId} deleted.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// 7. MANTRA HARDWARE PROXY (MFS110 L1 RD Service on port 11100 & MFS100 on 8032)
// ============================================================================
router.get('/mantra/info', async (req, res) => {
  // 1. Try Port 11100 (MFS110 RD Service)
  try {
    const rawXml = await new Promise((resolve, reject) => {
      const r = http.request({
        hostname: '127.0.0.1',
        port: 11100,
        path: '/rd/info',
        method: 'DEVICEINFO',
        headers: { Connection: 'close' },
        timeout: 1500,
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
      r.end();
    });

    if (rawXml && rawXml.includes('DeviceInfo')) {
      const miMatch = rawXml.match(/mi="([^"]+)"/);
      const srnoMatch = rawXml.match(/name="srno"\s+value="([^"]+)"/);
      const devTypeMatch = rawXml.match(/name="device_type"\s+value="([^"]+)"/);
      return res.json({
        isConnected: true,
        make: 'Mantra',
        model: miMatch ? miMatch[1] : 'MFS110',
        serialNo: srnoMatch ? srnoMatch[1] : '',
        deviceType: devTypeMatch ? devTypeMatch[1] : 'L1',
        port: 11100,
        serviceType: 'RDService'
      });
    }
  } catch (e) {
    // Port 11100 not responding, fall back
  }

  // 2. Try Port 8032 (MFS100 Client Service)
  try {
    const jsonRes = await new Promise((resolve, reject) => {
      const r = http.request({
        hostname: '127.0.0.1',
        port: 8032,
        path: '/mfs100/info',
        method: 'GET',
        headers: { Connection: 'close' },
        timeout: 1500,
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
      r.end();
    });

    if (jsonRes) {
      const parsed = JSON.parse(jsonRes);
      return res.json({
        isConnected: true,
        make: parsed.DeviceInfo?.Make || 'Mantra',
        model: parsed.DeviceInfo?.Model || 'MFS100',
        serialNo: parsed.DeviceInfo?.SerialNo || '',
        port: 8032,
        serviceType: 'ClientService'
      });
    }
  } catch (e) {
    // Both failed
  }

  return res.json({
    isConnected: false,
    make: 'Mantra',
    model: 'MFS110',
    serialNo: '',
    error: 'Mantra RD Service not responding on port 11100 or 8032. Please ensure device is plugged in.'
  });
});

router.post('/mantra/capture', async (req, res) => {
  const timeoutMs = parseInt(req.body.timeout || '10000', 10);
  const pidXml = `<PidOptions ver="1.0">
  <Opts fCount="1" fType="0" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="${timeoutMs}" env="P" posh="UNKNOWN" />
  <Demo></Demo>
  <CustOpts>
    <Param name="mantrakey" value="" />
  </CustOpts>
</PidOptions>`;

  // 1. Try Port 11100 (MFS110 RD Service)
  try {
    const rawXml = await new Promise((resolve, reject) => {
      const r = http.request({
        hostname: '127.0.0.1',
        port: 11100,
        path: '/rd/capture',
        method: 'CAPTURE',
        headers: {
          'Content-Type': 'text/xml',
          'Content-Length': Buffer.byteLength(pidXml, 'utf8'),
          'Connection': 'close'
        },
        timeout: timeoutMs + 3000,
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('Capture timed out')); });
      r.write(pidXml);
      r.end();
    });

    if (rawXml) {
      const errCodeMatch = rawXml.match(/errCode="([^"]+)"/);
      const errInfoMatch = rawXml.match(/errInfo="([^"]+)"/);
      const qScoreMatch = rawXml.match(/qScore="([^"]+)"/);
      const nmPointsMatch = rawXml.match(/nmPoints="([^"]+)"/);
      const dataMatch = rawXml.match(/<Data[^>]*>([\s\S]*?)<\/Data>/);
      const hmacMatch = rawXml.match(/<Hmac>([\s\S]*?)<\/Hmac>/);

      const errCode = errCodeMatch ? parseInt(errCodeMatch[1], 10) : -1;
      const success = errCode === 0;

      return res.json({
        success,
        errorCode: errCode,
        errorDescription: errInfoMatch ? errInfoMatch[1] : (success ? 'Success' : 'Capture failed'),
        quality: qScoreMatch ? parseInt(qScoreMatch[1], 10) : 0,
        nmPoints: nmPointsMatch ? parseInt(nmPointsMatch[1], 10) : 0,
        isoTemplate: dataMatch ? dataMatch[1].trim() : '',
        hmac: hmacMatch ? hmacMatch[1].trim() : '',
        bitmapData: '', // RD Service sends template data
        model: 'MFS110'
      });
    }
  } catch (e) {
    if (e.message && e.message.includes('timed out')) {
      return res.json({
        success: false,
        errorCode: 700,
        errorDescription: 'Capture timed out',
        quality: 0,
        isoTemplate: '',
        bitmapData: '',
        model: 'MFS110'
      });
    }
    // Port 11100 failed or not running, try Port 8032 (MFS100)
  }

  // 2. Try Port 8032 (MFS100 Client Service)
  try {
    const payload = JSON.stringify({ Quality: 60, TimeOut: Math.round(timeoutMs / 1000) });
    const jsonRes = await new Promise((resolve, reject) => {
      const r = http.request({
        hostname: '127.0.0.1',
        port: 8032,
        path: '/mfs100/capture',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload, 'utf8'),
          'Connection': 'close'
        },
        timeout: timeoutMs + 3000,
      }, (response) => {
        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('Capture timed out')); });
      r.write(payload);
      r.end();
    });

    if (jsonRes) {
      const parsed = JSON.parse(jsonRes);
      const success = parsed.ErrorCode === 0 || parsed.ErrorCode === '0';
      return res.json({
        success,
        errorCode: parsed.ErrorCode,
        errorDescription: parsed.ErrorDescription || (success ? 'Success' : 'Failed'),
        quality: parsed.Quality || 0,
        isoTemplate: parsed.IsoTemplate || '',
        bitmapData: parsed.BitmapData ? `data:image/bmp;base64,${parsed.BitmapData}` : '',
        model: 'MFS100'
      });
    }
  } catch (err) {
    return res.json({
      success: false,
      errorCode: -1,
      errorDescription: err.message || 'Mantra communication error'
    });
  }
});

export default router;
