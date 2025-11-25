import codecs

# Read the file with proper encoding
with codecs.open('server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the strategies section
output = []
i = 0
while i < len(lines):
    line = lines[i]
    
    # Check if we're at the Strategy 1 line
    if '// Strategy 1: Split by question numbers (Q1, Q2, 1., 2., etc.)' in line:
        # Replace old strategies with new ones
        output.append('    // Strategy 1: Look for "Q1:" or "Q1." patterns followed by numbered questions with options\n')
        output.append('    const qBlocks = text.split(/Q\\d+:/i);\n')
        output.append('    \n')
        output.append('    for (let i = 1; i < qBlocks.length; i++) {\n')
        output.append('        const block = qBlocks[i].trim();\n')
        output.append('        if (block.length < 10) continue;\n')
        output.append('        \n')
        output.append('        // Parse this Q block which may contain multiple numbered questions\n')
        output.append('        const numberedQuestions = parseNumberedQuestions(block, language);\n')
        output.append('        questions.push(...numberedQuestions);\n')
        output.append('    }\n')
        output.append('    \n')
        output.append('    // Strategy 2: If no Q blocks found, split by question numbers (1., 2., etc.)\n')
        output.append('    if (questions.length === 0) {\n')
        output.append('        const numberedQuestions = parseNumberedQuestions(text, language);\n')
        output.append('        questions.push(...numberedQuestions);\n')
        output.append('    }\n')
        output.append('    \n')
        output.append('    // Strategy 3: If no questions found, try splitting by double newlines\n')
        
        # Skip old Strategy 1 code until we find Strategy 2
        while i < len(lines) and '// Strategy 2: If no questions found, try splitting by double newlines' not in lines[i]:
            i += 1
        
        # Skip the old Strategy 2 header since we already added Strategy 3
        if i < len(lines):
            i += 1
            
    elif '// Strategy 4: If still no questions, try line-by-line with option detection' in line:
        # Keep Strategy 4 as is
        output.append(line)
        i += 1
    else:
        output.append(line)
        i += 1

# Write back
with codecs.open('server.js', 'w', encoding='utf-8') as f:
    f.writelines(output)

print("✓ server.js parsing strategies updated successfully")
