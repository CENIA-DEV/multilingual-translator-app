import { useState, useEffect } from 'react';

export function useTextSelection() {
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    const handleSelection = () => {
      let text = '';
      const activeEl = document.activeElement;

      // Handle Textarea/Input elements where window.getSelection() doesn't work
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        
        if (typeof start === 'number' && typeof end === 'number') {
          if (start !== end) {
            // User highlighted text
            text = activeEl.value.substring(start, end).trim();
          } else {
            // User just clicked (cursor position). Find the surrounding word.
            const val = activeEl.value;
            let i = start - 1;
            while (i >= 0 && /\S/.test(val[i])) i--;
            let j = start;
            while (j < val.length && /\S/.test(val[j])) j++;
            
            if (j > i + 1) {
              text = val.substring(i + 1, j).trim();
            }
          }
        }
      } else {
        // Handle normal HTML elements
        const selection = window.getSelection();
        if (selection) {
          text = selection.toString().trim();
        }
      }

      // Remove punctuation marks for cleaner dictionary search
      text = text.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

      // Only set if there is a valid short word/phrase selected
      if (text && text.length > 0 && text.length < 30) {
        setSelectedText(text);
      } else {
        setSelectedText(''); // hide if nothing is selected
      }
    };
    
    // Listen to mouseup (clicking/highlighting) and keyup (typing/arrow keys)
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection);
    
    return () => {
      document.removeEventListener('mouseup', handleSelection);
      document.removeEventListener('keyup', handleSelection);
    };
  }, []);

  return { selectedText, setSelectedText };
}
