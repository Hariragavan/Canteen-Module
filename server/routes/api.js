import { Router } from 'express';
import { Employee } from '../models/Employee.js';
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
      const [empCount, orderCount, slotCount, transportCount, feedbackCount] = await Promise.all([
        Employee.countDocuments(),
        Order.countDocuments(),
        MealSlot.countDocuments(),
        FoodTransport.countDocuments(),
        Feedback.countDocuments(),
      ]);
      return res.json({
        ...status,
        counts: {
          employees: empCount,
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
    res.json({ success: true, message: `Employee ${cleanId} deleted.` });
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

export default router;
