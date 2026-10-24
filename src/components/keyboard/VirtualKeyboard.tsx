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
        // Don't bind to checkboxes or radio buttons
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

      // React 16+ input setter dispatch so state updates trigger properly
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
        // ignore on mobile
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
      // Dispatch Enter keyboard event
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

  return (
    <>
      {/* ================================================================= */}
      {/* 1. FLOATING SMALL CIRCLE BUTTON IN LEFT CORNER (WHITE THEME)       */}
      {/* ================================================================= */}
      <div className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 print:hidden select-none">
        <button
          type="button"
          onClick={() => {
            soundEngine.playSelectSound();
            setIsOpen((prev) => !prev);
          }}
          title={isOpen ? 'விசைப்பலகையை மூடு / Close' : 'விசைப்பலகை / Virtual Keyboard'}
          className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 group shadow-lg ${
            isOpen
              ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 shadow-emerald-500/30'
              : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-emerald-600 border border-slate-200/90 shadow-slate-300/40 hover:shadow-xl'
          }`}
        >
          {/* Centered Keyboard Icon */}
          <KeyboardIcon
            className={`w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200 group-hover:scale-110 ${
              isOpen ? 'text-white' : 'text-slate-700 group-hover:text-emerald-600'
            }`}
          />

          {/* Small Language Badge Dot on Corner */}
          <span
            className={`absolute -bottom-1 -right-1 text-[9px] font-bold font-mono px-1.5 py-0.2 rounded-full border shadow-2xs leading-tight transition-colors ${
              isOpen
                ? 'bg-white text-emerald-800 border-emerald-300'
                : 'bg-slate-800 text-white border-white'
            }`}
          >
            {mode === 'tamil' ? 'த' : mode === 'english' ? 'EN' : '#'}
          </span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* 2. SLIDE-UP VIRTUAL KEYBOARD DOCK (CLEAN WHITE THEME)              */}
      {/* ================================================================= */}
      {isOpen && (
        <div
          ref={keyboardContainerRef}
          className="fixed bottom-0 sm:bottom-4 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 max-w-4xl w-full z-50 p-2 sm:p-3 print:hidden select-none animate-in fade-in slide-in-from-bottom-8 duration-200"
        >
          <div className="bg-white/98 backdrop-blur-2xl border border-slate-200/90 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-slate-400/30 flex flex-col overflow-hidden text-slate-800">
            
            {/* --- Keyboard Header & Controls (White Theme) --- */}
            <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              
              {/* Left: Language Tabs */}
              <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSelectSound();
                    setMode('tamil');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mode === 'tamil'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  தமிழ் (Tamil)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSelectSound();
                    setMode('english');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mode === 'english'
                      ? 'bg-emerald-600 text-white shadow-xs'
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
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mode === 'symbols'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ?123
                </button>
              </div>

              {/* Center: Active Input Status & Preview */}
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs shadow-2xs">
                <span className="text-[10px] font-mono text-emerald-600 uppercase font-bold shrink-0">
                  Target:
                </span>
                <span className="text-slate-700 font-medium truncate flex-1 font-sans">
                  {activeTargetName || (buffer ? buffer : 'Tap any input box on screen to type')}
                </span>
                {buffer && (
                  <button
                    type="button"
                    onClick={handleCopyBuffer}
                    title="Copy text"
                    className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-md shrink-0 transition-all"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Right: Close / Minimize Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-200/80 rounded-xl text-slate-500 hover:text-slate-800 transition-all active:scale-95 shrink-0"
                title="விசைப்பலகையை மூடு / Close Keyboard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* --- Keyboard Keys Surface (Clean White Theme) --- */}
            <div className="p-2 sm:p-3 flex flex-col gap-1.5 sm:gap-2 bg-slate-50/40">

              {/* ======================================================= */}
              {/* LAYOUT 1: TAMIL (தமிழ் 99 / Classical)                 */}
              {/* ======================================================= */}
              {mode === 'tamil' && (
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  
                  {/* Row 1: Numbers & Aytham */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
                    {TAMIL_NUMBERS.map((num) => (
                      <KeyButton key={num} label={num} onClick={() => insertText(num)} />
                    ))}
                    <KeyButton label="ஃ" sub="ஆய்தம்" highlight onClick={() => insertText('ஃ')} />
                    <KeyButton
                      label="Backspace"
                      icon={<Delete className="w-4 h-4 text-amber-700" />}
                      className="bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800 flex-1 max-w-[90px]"
                      onClick={handleBackspace}
                    />
                  </div>

                  {/* Row 2: Uyir (Vowels) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center flex-wrap">
                    <span className="hidden sm:inline-block text-[10px] font-mono text-emerald-700 font-bold mr-1 shrink-0">
                      உயிர்:
                    </span>
                    {TAMIL_VOWELS.map((vowel) => (
                      <KeyButton
                        key={vowel}
                        label={vowel}
                        className="bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200 text-emerald-900 font-bold"
                        onClick={() => insertText(vowel)}
                      />
                    ))}
                  </div>

                  {/* Row 3: Consonants Part 1 (க ங ச ஞ ட ண த ந ப ம) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center flex-wrap">
                    <span className="hidden sm:inline-block text-[10px] font-mono text-slate-500 font-bold mr-1 shrink-0">
                      மெய் 1:
                    </span>
                    {TAMIL_CONSONANTS_1.map((c) => (
                      <KeyButton key={c} label={c} onClick={() => insertText(c)} />
                    ))}
                  </div>

                  {/* Row 4: Consonants Part 2 + Grantha (ய ர ல வ ழ ள ற ன + ஜ ஷ ஸ ஹ ஸ்ரீ) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center flex-wrap">
                    <span className="hidden sm:inline-block text-[10px] font-mono text-slate-500 font-bold mr-1 shrink-0">
                      மெய் 2:
                    </span>
                    {TAMIL_CONSONANTS_2.map((c) => (
                      <KeyButton key={c} label={c} onClick={() => insertText(c)} />
                    ))}
                    {TAMIL_GRANTHA.map((g) => (
                      <KeyButton
                        key={g}
                        label={g}
                        className="bg-purple-50/80 hover:bg-purple-100 border-purple-200 text-purple-900 font-bold"
                        onClick={() => insertText(g)}
                      />
                    ))}
                  </div>

                  {/* Row 5: Vowel Signs / Diacritics (் ா ி ீ ு ூ ெ ே ை ொ ோ ௌ) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center flex-wrap bg-amber-50/40 py-1.5 px-2 rounded-2xl border border-amber-200/80">
                    <span className="text-[10px] font-mono text-amber-800 mr-1.5 shrink-0 font-bold">
                      குறியீடு:
                    </span>
                    {TAMIL_DIACRITICS.map((d) => (
                      <KeyButton
                        key={d}
                        label={d}
                        className="bg-white hover:bg-amber-100 border-amber-200 text-amber-900 font-extrabold text-base sm:text-lg min-w-[34px] sm:min-w-[42px] shadow-2xs"
                        onClick={() => insertText(d)}
                      />
                    ))}
                  </div>

                  {/* Quick Canteen Words Pill Bar */}
                  <div className="hidden sm:flex items-center gap-1.5 justify-center overflow-x-auto py-0.5">
                    <span className="text-[10px] text-slate-500 shrink-0 font-mono font-bold">சொற்கள்:</span>
                    {TAMIL_QUICK_WORDS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => insertText(w + ' ')}
                        className="px-2.5 py-1 rounded-lg text-xs bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 shrink-0 transition-all active:scale-95 shadow-2xs"
                      >
                        {w}
                      </button>
                    ))}
                  </div>

                  {/* Bottom Control Row */}
                  <div className="flex items-center gap-1.5 sm:gap-2 justify-center mt-0.5">
                    <button
                      type="button"
                      onClick={() => setMode('english')}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                    >
                      <Languages className="w-3.5 h-3.5 text-emerald-600" />
                      <span>English</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>

                    {/* Spacebar */}
                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-2xs"
                    >
                      <Space className="w-4 h-4 text-slate-400" />
                      <span>இடைவெளி (Space)</span>
                    </button>

                    <KeyButton label="." onClick={() => insertText('.')} className="min-w-[36px]" />
                    <KeyButton label="," onClick={() => insertText(',')} className="min-w-[36px]" />

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-emerald-600/30"
                    >
                      <span>உள்ளிடு</span>
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              )}

              {/* ======================================================= */}
              {/* LAYOUT 2: ENGLISH (QWERTY)                              */}
              {/* ======================================================= */}
              {mode === 'english' && (
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  
                  {/* Row 1: Numbers */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
                    {ENGLISH_ROW_1.map((char) => (
                      <KeyButton key={char} label={char} onClick={() => insertText(char)} />
                    ))}
                    <KeyButton
                      label="Backspace"
                      icon={<Delete className="w-4 h-4 text-amber-700" />}
                      className="bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800 flex-1 max-w-[90px]"
                      onClick={handleBackspace}
                    />
                  </div>

                  {/* Row 2: QWERTY */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
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
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
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
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
                    <button
                      type="button"
                      onClick={() => setIsShiftActive((prev) => !prev)}
                      className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-2xs ${
                        isShiftActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
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

                    <KeyButton label="." onClick={() => insertText('.')} className="min-w-[36px]" />
                    <KeyButton label="," onClick={() => insertText(',')} className="min-w-[36px]" />
                    <KeyButton label="@" onClick={() => insertText('@')} className="min-w-[36px]" />
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-center gap-1.5 sm:gap-2 justify-center mt-0.5">
                    <button
                      type="button"
                      onClick={() => setMode('tamil')}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                    >
                      <Languages className="w-3.5 h-3.5 text-emerald-600" />
                      <span>தமிழ் (Tamil)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>

                    {/* Spacebar */}
                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-2xs"
                    >
                      <Space className="w-4 h-4 text-slate-400" />
                      <span>Spacebar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-emerald-600/30"
                    >
                      <span>Enter</span>
                      <CornerDownLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              )}

              {/* ======================================================= */}
              {/* LAYOUT 3: SYMBOLS (?123)                                */}
              {/* ======================================================= */}
              {mode === 'symbols' && (
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
                    {SYMBOLS_ROW_1.map((sym) => (
                      <KeyButton key={sym} label={sym} onClick={() => insertText(sym)} />
                    ))}
                    <KeyButton
                      label="Backspace"
                      icon={<Delete className="w-4 h-4 text-amber-700" />}
                      className="bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800 flex-1 max-w-[90px]"
                      onClick={handleBackspace}
                    />
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
                    {SYMBOLS_ROW_2.map((sym) => (
                      <KeyButton key={sym} label={sym} onClick={() => insertText(sym)} />
                    ))}
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center">
                    {SYMBOLS_ROW_3.map((sym) => (
                      <KeyButton key={sym} label={sym} onClick={() => insertText(sym)} />
                    ))}
                  </div>

                  {/* Bottom Row */}
                  <div className="flex items-center gap-1.5 sm:gap-2 justify-center mt-0.5">
                    <button
                      type="button"
                      onClick={() => setMode('tamil')}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 active:scale-95 transition-all shadow-2xs"
                    >
                      <Languages className="w-3.5 h-3.5 text-emerald-600" />
                      <span>தமிழ்</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('english')}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 active:scale-95 transition-all shadow-2xs"
                    >
                      ABC
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-1 active:scale-95 transition-all shadow-2xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-2xs"
                    >
                      <Space className="w-4 h-4 text-slate-400" />
                      <span>Spacebar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-emerald-600/30"
                    >
                      <span>Enter</span>
                      <CornerDownLeft className="w-3.5 h-3.5" />
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
// KEY BUTTON REUSABLE SUB-COMPONENT (CLEAN WHITE THEME)
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
      className={`relative min-w-[30px] sm:min-w-[40px] md:min-w-[46px] h-9 sm:h-11 px-1.5 sm:px-2 rounded-xl flex flex-col items-center justify-center transition-all duration-150 active:scale-90 select-none text-xs sm:text-sm font-medium ${
        highlight
          ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold shadow-2xs'
          : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs hover:border-slate-300'
      } ${className}`}
    >
      {icon ? (
        icon
      ) : (
        <>
          <span className="font-sans leading-none">{label}</span>
          {sub && <span className="text-[8px] text-emerald-600 font-mono scale-90">{sub}</span>}
        </>
      )}
    </button>
  );
};

export default VirtualKeyboard;
