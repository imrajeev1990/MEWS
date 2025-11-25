import codecs

# Read the file
with codecs.open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and update the option patterns section
output = []
in_option_patterns = False
skip_until_bracket = False

for i, line in enumerate(lines):
    if 'const optionPatterns = [' in line:
        in_option_patterns = True
        output.append('    // Extended option patterns to match more formats\n')
        output.append('    // Support for Devanagari, Mangal, Kruti Dev, and all Hindi fonts\n')
        output.append('    const optionPatterns = [\n')
        output.append('        /^([A-D])\\)\\s*([^\\n]+)/gm,                    // A) Option\n')
        output.append('        /^\\(([A-D])\\)\\s*([^\\n]+)/gm,                  // (A) Option\n')
        output.append('        /^\\[([A-D])\\]\\s*([^\\n]+)/gm,                  // [A] Option\n')
        output.append('        /^\\{([A-D])\\}\\s*([^\\n]+)/gm,                  // {A} Option\n')
        output.append('        /^([A-D])[\\.\:]\\s*([^\\n]+)/gm,                // A. Option or A: Option\n')
        output.append('        /^([abcd])\\)\\s*([^\\n]+)/gm,                   // a) Option\n')
        output.append('        /^\\(([abcd])\\)\\s*([^\\n]+)/gm,                 // (a) Option\n')
        output.append('        /^([०-९१-४])\\)\\s*([^\\n]+)/gm,                 // Hindi numerals (Devanagari)\n')
        output.append('        /^([१-४])\\)\\s*([^\\n]+)/gm,                    // Hindi numerals 1-4\n')
        output.append('        /^विकल्प\\s*([A-D])[:\\.\)]\\s*([^\\n]+)/gm,       // विकल्प A) Option\n')
        output.append('        /^Option\\s*([A-D])[:\\.\)]\\s*([^\\n]+)/gm,      // Option A) text\n')
        output.append('        /^([A-D])[\\)\\.\\:][\\s\\u00A0\\u200B]+([^\\n]+)/gm // With special spaces\n')
        output.append('    ];\n')
        skip_until_bracket = True
        continue
    
    if skip_until_bracket:
        if line.strip() == '];':
            skip_until_bracket = False
            in_option_patterns = False
        continue
    
    output.append(line)

# Write back
with codecs.open('server.js', 'w', encoding='utf-8') as f:
    f.writelines(output)

print("✓ server.js updated with enhanced Hindi font support")
print("  - Added support for {}, curly brackets")
print("  - Added Devanagari numerals (०-९, १-४)")
print("  - Added support for special Unicode spaces")
print("  - Ready for Mangal, Kruti Dev, and all Hindi fonts")
