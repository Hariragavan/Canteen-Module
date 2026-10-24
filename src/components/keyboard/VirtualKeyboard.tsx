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
      {/* 1. FLOATING BUTTON IN LEFT CORNER                                 */}
      {/* ================================================================= */}
      <div className="fixed bottom-3 left-3 sm:bottom-5 sm:left-5 z-50 print:hidden select-none">
        <button
          type="button"
          onClick={() => {
            soundEngine.playSelectSound();
            setIsOpen((prev) => !prev);
          }}
          title="விசைப்பலகை / Virtual Keyboard"
          className={`flex items-center gap-2 px-3.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl shadow-xl transition-all duration-300 font-medium active:scale-95 group ${
            isOpen
              ? 'bg-emerald-600 text-white ring-4 ring-emerald-400/40 shadow-emerald-500/25'
              : 'bg-slate-900/95 hover:bg-slate-800 text-slate-100 border border-slate-700/80 backdrop-blur-md shadow-slate-950/40 hover:border-emerald-500/50'
          }`}
        >
          {/* Animated Keyboard Icon */}
          <div className="relative flex items-center justify-center">
            <KeyboardIcon className={`w-5 h-5 transition-transform duration-300 ${isOpen ? 'scale-110 text-white' : 'text-emerald-400 group-hover:scale-110'}`} />
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>

          {/* Dual-Language Indicator Label */}
          <div className="flex flex-col text-left leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold font-sans tracking-tight">
                {mode === 'tamil' ? 'தமிழ்' : mode === 'english' ? 'English' : '123'}
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-md bg-white/15 text-white/90">
                {mode === 'tamil' ? 'TA' : 'EN'}
              </span>
            </div>
            <span className="text-[9px] text-slate-300 tracking-wider font-mono mt-0.5 opacity-80">
              {isOpen ? 'Close' : 'Keyboard'}
            </span>
          </div>
        </button>
      </div>

      {/* ================================================================= */}
      {/* 2. SLIDE-UP VIRTUAL KEYBOARD DOCK                                 */}
      {/* ================================================================= */}
      {isOpen && (
        <div
          ref={keyboardContainerRef}
          className="fixed bottom-0 sm:bottom-4 left-0 right-0 sm:left-1/2 sm:-translate-x-1/2 max-w-4xl w-full z-50 p-2 sm:p-3 print:hidden select-none animate-in fade-in slide-in-from-bottom-8 duration-200"
        >
          <div className="bg-slate-900/98 backdrop-blur-2xl border border-slate-700/90 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-slate-950/80 flex flex-col overflow-hidden text-white">
            
            {/* --- Keyboard Header & Controls --- */}
            <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-slate-800/80 border-b border-slate-700/70 flex items-center justify-between gap-2 flex-wrap">
              
              {/* Left: Language Tabs */}
              <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playSelectSound();
                    setMode('tamil');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    mode === 'tamil'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
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
                      : 'text-slate-400 hover:text-white'
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
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ?123
                </button>
              </div>

              {/* Center: Active Input Status & Preview */}
              <div className="flex-1 min-w-[200px] flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold shrink-0">
                  Target:
                </span>
                <span className="text-slate-300 font-medium truncate flex-1 font-sans">
                  {activeTargetName || (buffer ? buffer : 'Tap any input box on screen to type')}
                </span>
                {buffer && (
                  <button
                    type="button"
                    onClick={handleCopyBuffer}
                    title="Copy text"
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md shrink-0 transition-all"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>

              {/* Right: Close / Minimize Button */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-700/80 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 shrink-0"
                title="விசைப்பலகையை மூடு / Close Keyboard"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* --- Keyboard Keys Surface --- */}
            <div className="p-2 sm:p-3 flex flex-col gap-1.5 sm:gap-2">

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
                      icon={<Delete className="w-4 h-4 text-amber-300" />}
                      className="bg-amber-950/40 border-amber-700/60 hover:bg-amber-900/60 text-amber-200 flex-1 max-w-[90px]"
                      onClick={handleBackspace}
                    />
                  </div>

                  {/* Row 2: Uyir (Vowels) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center flex-wrap">
                    <span className="hidden sm:inline-block text-[10px] font-mono text-emerald-400/80 mr-1 shrink-0">
                      உயிர்:
                    </span>
                    {TAMIL_VOWELS.map((vowel) => (
                      <KeyButton
                        key={vowel}
                        label={vowel}
                        className="bg-emerald-950/30 border-emerald-800/40 hover:bg-emerald-900/50 text-emerald-100 font-bold"
                        onClick={() => insertText(vowel)}
                      />
                    ))}
                  </div>

                  {/* Row 3: Consonants Part 1 (க ங ச ஞ ட ண த ந ப ம) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center flex-wrap">
                    <span className="hidden sm:inline-block text-[10px] font-mono text-blue-400/80 mr-1 shrink-0">
                      மெய் 1:
                    </span>
                    {TAMIL_CONSONANTS_1.map((c) => (
                      <KeyButton key={c} label={c} onClick={() => insertText(c)} />
                    ))}
                  </div>

                  {/* Row 4: Consonants Part 2 + Grantha (ய ர ல வ ழ ள ற ன + ஜ ஷ ஸ ஹ ஸ்ரீ) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center flex-wrap">
                    <span className="hidden sm:inline-block text-[10px] font-mono text-blue-400/80 mr-1 shrink-0">
                      மெய் 2:
                    </span>
                    {TAMIL_CONSONANTS_2.map((c) => (
                      <KeyButton key={c} label={c} onClick={() => insertText(c)} />
                    ))}
                    {TAMIL_GRANTHA.map((g) => (
                      <KeyButton
                        key={g}
                        label={g}
                        className="bg-purple-950/30 border-purple-800/40 hover:bg-purple-900/50 text-purple-200"
                        onClick={() => insertText(g)}
                      />
                    ))}
                  </div>

                  {/* Row 5: Vowel Signs / Diacritics (் ா ி ீ ு ூ ெ ே ை ொ ோ ௌ) */}
                  <div className="flex items-center gap-1 sm:gap-1.5 justify-center flex-wrap bg-slate-950/40 py-1.5 px-2 rounded-2xl border border-slate-800/70">
                    <span className="text-[10px] font-mono text-amber-400/80 mr-1.5 shrink-0 font-bold">
                      குறியீடு:
                    </span>
                    {TAMIL_DIACRITICS.map((d) => (
                      <KeyButton
                        key={d}
                        label={d}
                        className="bg-amber-950/30 border-amber-800/40 hover:bg-amber-900/50 text-amber-200 font-extrabold text-base sm:text-lg min-w-[34px] sm:min-w-[42px]"
                        onClick={() => insertText(d)}
                      />
                    ))}
                  </div>

                  {/* Quick Canteen Words Pill Bar */}
                  <div className="hidden sm:flex items-center gap-1.5 justify-center overflow-x-auto py-0.5">
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">சொற்கள்:</span>
                    {TAMIL_QUICK_WORDS.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => insertText(w + ' ')}
                        className="px-2.5 py-1 rounded-lg text-xs bg-slate-800/90 hover:bg-slate-700 border border-slate-700/60 text-slate-200 shrink-0 transition-all active:scale-95"
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
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <Languages className="w-3.5 h-3.5 text-emerald-400" />
                      <span>English</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-xs font-bold text-rose-300 flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>

                    {/* Spacebar */}
                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-2 sm:py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-inner"
                    >
                      <Space className="w-4 h-4 text-slate-400" />
                      <span>இடைவெளி (Space)</span>
                    </button>

                    <KeyButton label="." onClick={() => insertText('.')} className="min-w-[36px]" />
                    <KeyButton label="," onClick={() => insertText(',')} className="min-w-[36px]" />

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-emerald-600/30"
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
                      icon={<Delete className="w-4 h-4 text-amber-300" />}
                      className="bg-amber-950/40 border-amber-700/60 hover:bg-amber-900/60 text-amber-200 flex-1 max-w-[90px]"
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
                      className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95 ${
                        isShiftActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
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
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 text-xs font-bold text-emerald-200 flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <Languages className="w-3.5 h-3.5" />
                      <span>தமிழ் (Tamil)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-xs font-bold text-rose-300 flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>

                    {/* Spacebar */}
                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-2 sm:py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-inner"
                    >
                      <Space className="w-4 h-4 text-slate-400" />
                      <span>Spacebar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-emerald-600/30"
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
                      icon={<Delete className="w-4 h-4 text-amber-300" />}
                      className="bg-amber-950/40 border-amber-700/60 hover:bg-amber-900/60 text-amber-200 flex-1 max-w-[90px]"
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
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      <Languages className="w-3.5 h-3.5 text-emerald-400" />
                      <span>தமிழ்</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode('english')}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 active:scale-95 transition-all"
                    >
                      ABC
                    </button>

                    <button
                      type="button"
                      onClick={handleClear}
                      className="px-3 py-2 sm:py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-xs font-bold text-rose-300 flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => insertText(' ')}
                      className="flex-1 py-2 sm:py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-xs font-medium text-slate-300 flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-inner"
                    >
                      <Space className="w-4 h-4 text-slate-400" />
                      <span>Spacebar</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleEnter}
                      className="px-4 py-2 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-sm shadow-emerald-600/30"
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
// KEY BUTTON REUSABLE SUB-COMPONENT
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
      className={`relative min-w-[30px] sm:min-w-[40px] md:min-w-[46px] h-9 sm:h-11 px-1.5 sm:px-2 rounded-xl flex flex-col items-center justify-center transition-all duration-150 active:scale-90 select-none shadow-xs text-xs sm:text-sm font-medium ${
        highlight
          ? 'bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500'
          : 'bg-slate-800/95 hover:bg-slate-700 text-slate-100 border border-slate-700/80'
      } ${className}`}
    >
      {icon ? (
        icon
      ) : (
        <>
          <span className="font-sans leading-none">{label}</span>
          {sub && <span className="text-[8px] text-emerald-400 font-mono scale-90">{sub}</span>}
        </>
      )}
    </button>
  );
};
export default VirtualKeyboard;
