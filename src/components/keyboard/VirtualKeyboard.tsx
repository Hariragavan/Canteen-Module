import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Keyboard as KeyboardIcon,
  X,
  Languages,
  Delete,
  CornerDownLeft,
  Space,
  Trash2,
  Copy,
  Check,
  ArrowUp,
  GripHorizontal,
} from 'lucide-react';
import { soundEngine } from '../../services/soundEngine';

type KeyboardMode = 'tamil' | 'english' | 'symbols';

// ==============================================================================
// TAMIL KEYBOARD DATA
// Standard Unicode Tamil Alphabet: Vowels (உயிர்), Consonants (மெய்), Diacritics (குறியீடுகள்), Grantha (கிரந்தம்)
// ==============================================================================
const TAMIL_NUMBERS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const TAMIL_VOWELS = ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'ஊ', 'எ', 'ஏ', 'ஐ', 'ஒ', 'ஓ', 'ஔ', 'ஃ'];
const TAMIL_CONSONANTS_1 = ['க', 'ங', 'ச', 'ஞ', 'ட', 'ண', 'த', 'ந', 'ப', 'ம'];
const TAMIL_CONSONANTS_2 = ['ய', 'ர', 'ல', 'வ', 'ழ', 'ள', 'ற', 'ன'];
const TAMIL_GRANTHA = ['ஜ', 'ஷ', 'ஸ', 'ஹ', 'க்ஷ', 'ஸ்ரீ'];
const TAMIL_DIACRITICS = ['்', 'ா', 'ி', 'ீ', 'ு', 'ூ', 'ெ', 'ே', 'ை', 'ொ', 'ோ', 'ௌ'];

// Common high-frequency Tamil words in Canteen
const TAMIL_QUICK_WORDS = ['மதிய உணவு', 'காலை உணவு', 'டிபன்', 'சாப்பாடு', 'தேநீர்', 'ஸ்நாக்ஸ்', 'ஆமாம்', 'இல்லை'];

// ==============================================================================
// ENGLISH KEYBOARD DATA (QWERTY)
// ==============================================================================
const ENGLISH_ROW_1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
const ENGLISH_ROW_2 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
const ENGLISH_ROW_3 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
const ENGLISH_ROW_4 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

// ==============================================================================
// SYMBOLS DATA
// ==============================================================================
const SYMBOLS_ROW_1 = ['!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+'];
const SYMBOLS_ROW_2 = ['~', '`', '{', '}', '[', ']', '\\', '|', ';', ':'];
const SYMBOLS_ROW_3 = ['"', "'", '<', '>', ',', '.', '?', '/', '₹', '€'];

export const VirtualKeyboard: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [mode, setMode] = useState<KeyboardMode>('tamil');
  const [isShiftActive, setIsShiftActive] = useState<boolean>(false);
  const [buffer, setBuffer] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [activeTargetName, setActiveTargetName] = useState<string | null>(null);

  // Position state for draggable behavior
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  // Reference to the active input element on the page
  const activeInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const keyboardContainerRef = useRef<HTMLDivElement | null>(null);

  // Track focused input anywhere on the page
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // Don't track inputs inside the virtual keyboard itself
      if (keyboardContainerRef.current && keyboardContainerRef.current.contains(target)) {
        return;
      }

      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        const input = target as HTMLInputElement | HTMLTextAreaElement;
        if (input.type !== 'checkbox' && input.type !== 'radio' && input.type !== 'file') {
          activeInputRef.current = input;
          setActiveTargetName(input.placeholder || input.name || input.id || 'Active Field');
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  // Safe insertion into the active input element or buffer
  const insertText = useCallback((textToInsert: string) => {
    soundEngine.playSelectSound();
    const target = activeInputRef.current;

    if (target && document.body.contains(target)) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const val = target.value;
      const newVal = val.substring(0, start) + textToInsert + val.substring(end);

      const nativeSetter = Object.getOwnPropertyDescriptor(
        target instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(target, newVal);
      } else {
        target.value = newVal;
      }

      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));

      const newPos = start + textToInsert.length;
      try {
        target.setSelectionRange(newPos, newPos);
        target.focus();
      } catch {
        // ignore
      }
    }

    setBuffer((prev) => prev + textToInsert);
  }, []);

  // Backspace handler
  const handleBackspace = useCallback(() => {
    soundEngine.playSelectSound();
    const target = activeInputRef.current;

    if (target && document.body.contains(target)) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;

      if (start > 0 || end > start) {
        const val = target.value;
        const deleteFrom = start === end ? start - 1 : start;
        const newVal = val.substring(0, deleteFrom) + val.substring(end);

        const nativeSetter = Object.getOwnPropertyDescriptor(
          target instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
          'value'
        )?.set;

        if (nativeSetter) {
          nativeSetter.call(target, newVal);
        } else {
          target.value = newVal;
        }

        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));

        try {
          target.setSelectionRange(deleteFrom, deleteFrom);
          target.focus();
        } catch {
          // ignore
        }
      }
    }

    setBuffer((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
  }, []);

  // Clear handler
  const handleClear = useCallback(() => {
    soundEngine.playSelectSound();
    const target = activeInputRef.current;
    if (target && document.body.contains(target)) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        target instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeSetter) {
        nativeSetter.call(target, '');
      } else {
        target.value = '';
      }

      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      try {
        target.focus();
      } catch {
        // ignore
      }
    }
    setBuffer('');
  }, []);

  // Enter handler
  const handleEnter = useCallback(() => {
    soundEngine.playSelectSound();
    const target = activeInputRef.current;
    if (target && document.body.contains(target)) {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })
      );
      target.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true })
      );
    }
  }, []);

  // Copy buffer to clipboard
  const handleCopyBuffer = () => {
    if (!buffer) return;
    navigator.clipboard.writeText(buffer).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1800);
    });
  };

  // Pointer Drag Handlers (supports Mouse, Touch, & Tablet Stylus)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    if (!keyboardContainerRef.current) return;
    const rect = keyboardContainerRef.current.getBoundingClientRect();

    setIsDragging(true);
    dragOffsetRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const keyboardW = keyboardContainerRef.current?.offsetWidth || 560;
    const keyboardH = keyboardContainerRef.current?.offsetHeight || 260;

    let newX = e.clientX - dragOffsetRef.current.offsetX;
    let newY = e.clientY - dragOffsetRef.current.offsetY;

    // Constrain inside viewport
    newX = Math.max(8, Math.min(window.innerWidth - keyboardW - 8, newX));
    newY = Math.max(8, Math.min(window.innerHeight - keyboardH - 8, newY));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* ================================================================= */}
      {/* 1. COMPACT CIRCULAR BUTTON IN LEFT CORNER (ONLY KEYBOARD ICON)    */}
      {/* ================================================================= */}
      <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 print:hidden select-none">
        <button
          type="button"
          onClick={() => {
            soundEngine.playSelectSound();
            setIsOpen((prev) => !prev);
          }}
          title={isOpen ? 'Close Keyboard' : 'Virtual Keyboard'}
          aria-label="Toggle Virtual Keyboard"
          className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 shadow-md hover:shadow-lg ${
            isOpen
              ? 'bg-slate-800 text-white ring-2 ring-slate-300 shadow-slate-900/20'
              : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-300 shadow-slate-400/25'
          }`}
        >
          {/* Only the clean keyboard icon */}
          <KeyboardIcon className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'text-white' : 'text-slate-700'}`} />
        </button>
      </div>

      {/* ================================================================= */}
      {/* 2. DRAGGABLE & COMPACT VIRTUAL KEYBOARD (LIGHT GREY & WHITE)      */}
      {/* ================================================================= */}
      {isOpen && (
        <div
          ref={keyboardContainerRef}
          style={
            position
              ? { left: `${position.x}px`, top: `${position.y}px` }
              : { left: '50%', transform: 'translateX(-50%)', bottom: '16px' }
          }
          className="fixed z-50 w-[96vw] max-w-xl print:hidden select-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="bg-slate-100/98 backdrop-blur-md border border-slate-300 rounded-2xl shadow-xl shadow-slate-900/15 flex flex-col overflow-hidden text-slate-800">
            
            {/* --- Draggable Header Bar --- */}
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className={`px-2.5 py-1.5 bg-slate-200/90 border-b border-slate-300 flex items-center justify-between gap-1.5 touch-none select-none ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {/* Drag Handle Grip Icon */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-300/60 hover:bg-slate-300 text-slate-600 transition-colors shrink-0">
                <GripHorizontal className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-600">
                  Drag
                </span>
              </div>

              {/* Language Tabs */}
              <div className="flex items-center gap-1 bg-slate-300/80 p-0.5 rounded-lg border border-slate-300">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSelectSound();
                    setMode('tamil');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    mode === 'tamil'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  தமிழ்
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSelectSound();
                    setMode('english');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
                    mode === 'english'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  English
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSelectSound();
                    setMode('symbols');
                  }}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                    mode === 'symbols'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ?123
                </button>
              </div>

              {/* Center: Active Input Target / Preview */}
              <div className="flex-1 min-w-[120px] max-w-[220px] flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-300 text-[11px] truncate shadow-2xs">
                <span className="text-slate-700 font-medium truncate flex-1 font-sans">
                  {activeTargetName || (buffer ? buffer : 'Tap an input')}
                </span>
                {buffer && (
                  <button
                    type="button"
                    onClick={handleCopyBuffer}
                    title="Copy text"
                    className="p-0.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded shrink-0 transition-all"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Right: Close Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-300/80 rounded-lg text-slate-500 hover:text-slate-800 transition-all active:scale-95 shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* --- Keyboard Keys Surface (Compact Light Grey & White) --- */}
            <div className="p-1.5 sm:p-2 flex flex-col gap-1 sm:gap-1.5">

              {/* ======================================================= */}
              {/* LAYOUT 1: TAMIL                                         */}
              {/* ======================================================= */}
              {mode === 'tamil' && (
                <div className="flex flex-col gap-1 sm:gap-1.5">
                  
                  {/* Row 1: Numbers & Aytham */}
                  <div className="flex items-center gap-1 justify-center">
                    {TAMIL_NUMBERS.map((num) => (
                      <KeyButton key={num} label={num} onClick={() => insertText(num)} />
                    ))}
                    <KeyButton label="ஃ" sub="ஆய்தம்" highlight onClick={() => insertText('ஃ')} />
                    <KeyButton
                      label="Del"
                      icon={<Delete className="w-3.5 h-3.5" />}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 flex-1 max-w-[70px]"
                      onClick={handleBackspace}
                    />
                  </div>

                  {/* Row 2: Uyir (Vowels) */}
                  <div className="flex items-center gap-1 justify-center flex-wrap">
                    {TAMIL_VOWELS.map((vowel) => (
                      <KeyButton
                        key={vowel}
                        label={vowel}
                        className="font-bold text-slate-900"
                        onClick={() => insertText(vowel)}
                      />
                    ))}
                  </div>

                  {/* Row 3: Consonants Part 1 (க ங ச ஞ ட ண த ந ப ம) */}
                  <div className="flex items-center gap-1 justify-center flex-wrap">
                    {TAMIL_CONSONANTS_1.map((c) => (
                      <KeyButton key={c} label={c} onClick={() => insertText(c)} />
                    ))}
                  </div>

                  {/* Row 4: Consonants Part 2 + Grantha (ய ர ல வ ழ ள ற ன + ஜ ஷ ஸ ஹ ஸ்ரீ) */}
                  <div className="flex items-center gap-1 justify-center flex-wrap">
                    {TAMIL_CONSONANTS_2.map((c) => (
                      <KeyButton key={c} label={c} onClick={() => insertText(c)} />
                    ))}
                    {TAMIL_GRANTHA.map((g) => (
                      <KeyButton key={g} label={g} className="text-slate-700" onClick={() => insertText(g)} />
                    ))}
                  </div>

                  {/* Row 5: Vowel Signs / Diacritics (் ா ி ீ ு ூ ெ ே ை ொ ோ ௌ) */}
                  <div className="flex items-center gap-1 justify-center flex-wrap bg-slate-200/50 py-1 px-1.5 rounded-xl border border-slate-300">
                    <span className="text-[9px] font-mono text-slate-600 mr-1 shrink-0 font-bold">குறியீடு:</span>
                    {TAMIL_DIACRITICS.map((d) => (
                      <KeyButton
                        key={d}
                        label={d}
                        className="font-extrabold text-sm sm:text-base min-w-[28px] sm:min-w-[34px]"
                        onClick={() => insertText(d)}
                      />
                    ))}
                  </div>

                  {/* Quick Canteen Words */}
                  <div className="hidden sm:flex items-center gap-1 justify-center overflow-x-auto py-0.5">
                    {TAMIL_QUICK_WORDS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => insertText(w + ' ')}
                        className="px-2 py-0.5 rounded text-[11px] bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 shrink-0 transition-all active:scale-95 shadow-2xs"
                      >
                        {w}
                      </button>
                    ))}
                  </div>

                  {/* Bottom Control Row */}
                  <div className="flex items-center gap-1 justify-center mt-0.5">
                    <button
                      type="button"
                      onClick={() => setMode('english')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-[11px] font-bold text-slate-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <Languages className="w-3 h-3 text-slate-600" />
                      <span>ABC</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-[11px] font-bold text-slate-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>

                    {/* Spacebar */}
                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-[11px] font-medium text-slate-700 flex items-center justify-center gap-1 active:scale-98 transition-all shadow-2xs"
                    >
                      <Space className="w-3.5 h-3.5 text-slate-400" />
                      <span>Space</span>
                    </button>

                    <KeyButton label="." onClick={() => insertText('.')} className="min-w-[30px]" />
                    <KeyButton label="," onClick={() => insertText(',')} className="min-w-[30px]" />

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                    >
                      <span>Enter</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </button>
                  </div>

                </div>
              )}

              {/* ======================================================= */}
              {/* LAYOUT 2: ENGLISH (QWERTY)                              */}
              {/* ======================================================= */}
              {mode === 'english' && (
                <div className="flex flex-col gap-1 sm:gap-1.5">
                  
                  {/* Row 1: Numbers */}
                  <div className="flex items-center gap-1 justify-center">
                    {ENGLISH_ROW_1.map((char) => (
                      <KeyButton key={char} label={char} onClick={() => insertText(char)} />
                    ))}
                    <KeyButton
                      label="Del"
                      icon={<Delete className="w-3.5 h-3.5" />}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 flex-1 max-w-[70px]"
                      onClick={handleBackspace}
                    />
                  </div>

                  {/* Row 2: QWERTY */}
                  <div className="flex items-center gap-1 justify-center">
                    {ENGLISH_ROW_2.map((char) => {
                      const displayChar = isShiftActive ? char.toUpperCase() : char;
                      return (
                        <KeyButton
                          key={char}
                          label={displayChar}
                          onClick={() => insertText(displayChar)}
                        />
                      );
                    })}
                  </div>

                  {/* Row 3: ASDFGHJKL */}
                  <div className="flex items-center gap-1 justify-center">
                    {ENGLISH_ROW_3.map((char) => {
                      const displayChar = isShiftActive ? char.toUpperCase() : char;
                      return (
                        <KeyButton
                          key={char}
                          label={displayChar}
                          onClick={() => insertText(displayChar)}
                        />
                      );
                    })}
                  </div>

                  {/* Row 4: Shift + ZXCVBNM */}
                  <div className="flex items-center gap-1 justify-center">
                    <button
                      type="button"
                      onClick={() => setIsShiftActive((prev) => !prev)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-2xs ${
                        isShiftActive
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300'
                      }`}
                    >
                      <ArrowUp className="w-3 h-3" />
                      <span>Shift</span>
                    </button>

                    {ENGLISH_ROW_4.map((char) => {
                      const displayChar = isShiftActive ? char.toUpperCase() : char;
                      return (
                        <KeyButton
                          key={char}
                          label={displayChar}
                          onClick={() => insertText(displayChar)}
                        />
                      );
                    })}

                    <KeyButton label="." onClick={() => insertText('.')} className="min-w-[30px]" />
                    <KeyButton label="," onClick={() => insertText(',')} className="min-w-[30px]" />
                    <KeyButton label="@" onClick={() => insertText('@')} className="min-w-[30px]" />
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-center gap-1 justify-center mt-0.5">
                    <button
                      type="button"
                      onClick={() => setMode('tamil')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-[11px] font-bold text-slate-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <Languages className="w-3 h-3 text-slate-600" />
                      <span>தமிழ்</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-[11px] font-bold text-slate-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>

                    {/* Spacebar */}
                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-[11px] font-medium text-slate-700 flex items-center justify-center gap-1 active:scale-98 transition-all shadow-2xs"
                    >
                      <Space className="w-3.5 h-3.5 text-slate-400" />
                      <span>Space</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                    >
                      <span>Enter</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </button>
                  </div>

                </div>
              )}

              {/* ======================================================= */}
              {/* LAYOUT 3: SYMBOLS (?123)                                */}
              {/* ======================================================= */}
              {mode === 'symbols' && (
                <div className="flex flex-col gap-1 sm:gap-1.5">
                  <div className="flex items-center gap-1 justify-center">
                    {SYMBOLS_ROW_1.map((sym) => (
                      <KeyButton key={sym} label={sym} onClick={() => insertText(sym)} />
                    ))}
                    <KeyButton
                      label="Del"
                      icon={<Delete className="w-3.5 h-3.5" />}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 flex-1 max-w-[70px]"
                      onClick={handleBackspace}
                    />
                  </div>

                  <div className="flex items-center gap-1 justify-center">
                    {SYMBOLS_ROW_2.map((sym) => (
                      <KeyButton key={sym} label={sym} onClick={() => insertText(sym)} />
                    ))}
                  </div>

                  <div className="flex items-center gap-1 justify-center">
                    {SYMBOLS_ROW_3.map((sym) => (
                      <KeyButton key={sym} label={sym} onClick={() => insertText(sym)} />
                    ))}
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-center gap-1 justify-center mt-0.5">
                    <button
                      type="button"
                      onClick={() => setMode('tamil')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-[11px] font-bold text-slate-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <span>தமிழ்</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('english')}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-[11px] font-bold text-slate-700 active:scale-95 transition-all shadow-2xs"
                    >
                      ABC
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 border border-slate-300 text-[11px] font-bold text-slate-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-[11px] font-medium text-slate-700 flex items-center justify-center gap-1 active:scale-98 transition-all shadow-2xs"
                    >
                      <Space className="w-3.5 h-3.5 text-slate-400" />
                      <span>Space</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                    >
                      <span>Enter</span>
                      <CornerDownLeft className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ==============================================================================
// KEY BUTTON REUSABLE SUB-COMPONENT (LIGHT GREY & WHITE THEME)
// ==============================================================================
interface KeyButtonProps {
  label: string;
  sub?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
  className?: string;
  onClick: () => void;
}

const KeyButton: React.FC<KeyButtonProps> = ({
  label,
  sub,
  icon,
  highlight = false,
  className = '',
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-w-[24px] sm:min-w-[30px] md:min-w-[34px] h-7 sm:h-7.5 px-1 rounded-lg flex flex-col items-center justify-center transition-all duration-100 active:scale-90 select-none text-[11px] sm:text-xs font-medium bg-white hover:bg-slate-50 active:bg-slate-200 text-slate-800 border border-slate-300/90 shadow-2xs ${
        highlight ? 'font-bold bg-slate-50 border-slate-400 text-slate-900' : ''
      } ${className}`}
    >
      {icon ? (
        icon
      ) : (
        <>
          <span className="font-sans leading-none">{label}</span>
          {sub && <span className="text-[7px] text-slate-500 font-mono scale-90">{sub}</span>}
        </>
      )}
    </button>
  );
};

export default VirtualKeyboard;
