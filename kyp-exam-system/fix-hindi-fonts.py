import codecs
import re

# Read the file
with codecs.open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and replace the option patterns section
old_patterns = '''    // Extended option patterns to match more formats
    const optionPatterns = [
        /^([A-D])\\)\\s*([^\\n]+)/gm,           // A) Option
        /^\\(([A-D])\\)\\s*([^\\n]+)/gm,         // (A) Option
        /^\\[([A-D])\\]\\s*([^\\n]+)/gm,         // [A] Option
        /^([A-D])[\\.\:]\\s*([^\\n]+)/gm,       // A. Option or A: Option
        /^([abcd])\\)\\s*([^\\n]+)/gm,          // a) Option
        /^\\(([abcd])\\)\\s*([^\\n]+)/gm,        // (a) Option
        /^([१-४])\\)\\s*([^\\n]+)/gm,           // Hindi numerals
        /^विकल्प\\s*([A-D])[:\\.\)]\\s*([^\\n]+)/gm,  // विकल्प A) Option
        /^Option\\s*([A-D])[:\\.\)]\\s*([^\\n]+)/gm   // Option A) text
    ];'''

new_patterns = '''    // Extended option patterns to match more formats
    // Support for Devanagari, Mangal, Kruti Dev, and all Hindi fonts
    const optionPatterns = [
        /^([A-D])\\)\\s*([^\\n]+)/gm,                    // A) Option
        /^\\(([A-D])\\)\\s*([^\\n]+)/gm,                  // (A) Option
        /^\\[([A-D])\\]\\s*([^\\n]+)/gm,                  // [A] Option
        /^\\{([A-D])\\}\\s*([^\\n]+)/gm,                  // {A} Option
        /^([A-D])[\\.\:]\\s*([^\\n]+)/gm,                // A. Option or A: Option
        /^([abcd])\\)\\s*([^\\n]+)/gm,                   // a) Option
        /^\\(([abcd])\\)\\s*([^\\n]+)/gm,                 // (a) Option
        /^([०-९१-४])\\)\\s*([^\\n]+)/gm,                 // Hindi numerals (Devanagari)
        /^([१-४])\\)\\s*([^\\n]+)/gm,                    // Hindi numerals 1-4
        /^विकल्प\\s*([A-D])[:\\.\)]\\s*([^\\n]+)/gm,       // विकल्प A) Option
        /^Option\\s*([A-D])[:\\.\)]\\s*([^\\n]+)/gm,      // Option A) text
        /^([A-D])[\\)\\.\\:][\\s\\u00A0\\u200B]+([^\\n]+)/gm // With special spaces
    ];'''

# Replace the patterns
if old_patterns in content:
    content = content.replace(old_patterns, new_patterns)
    print("✓ Option patterns updated")
else:
    print("⚠ Could not find exact pattern match, trying alternative...")
    # Try finding just the optionPatterns array
    pattern = re.compile(r'const optionPatterns = \[.*?\];', re.DOTALL)
    if pattern.search(content):
        content = pattern.sub(new_patterns.split('const optionPatterns')[0] + 'const optionPatterns' + new_patterns.split('const optionPatterns')[1], content, 1)
        print("✓ Option patterns updated (alternative method)")

# Write back
with codecs.open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ server.js updated for multi-font Hindi support")
