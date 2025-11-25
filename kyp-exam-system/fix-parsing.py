import re

# Read the server.js file
with open('server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find and add the parseNumberedQuestions function before parseQuestionsFromText
parse_numbered_func = '''
function parseNumberedQuestions(text, language) {
    const questions = [];
    
    // Split by numbered patterns like "1.", "2.", etc. but keep the number
    const parts = text.split(/(?=\\d+\\.\\s)/);
    
    for (let part of parts) {
        part = part.trim();
        if (part.length < 10) continue;
        
        // Match pattern: "1. Question text? 2. Another question? 3. ..."
        // Look for sentences ending with ? followed by a number
        const lines = part.split('\\n');
        let currentQuestion = '';
        let currentOptions = [];
        let questionStarted = false;
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // Check if this is a numbered item (like "1. ", "2. ", etc.)
            const numberMatch = line.match(/^(\\d+)\\.\\s*(.+)$/);
            
            // Check if this is an option line
            const optionMatch = line.match(/^[(\\[]?([A-Da-d])[\\])][\\.\\):]?\\s*(.+)$/);
            
            if (optionMatch && currentQuestion) {
                // This is an option for the current question
                currentOptions.push(optionMatch[2].trim());
                
                // If we have 4 options, we've completed this question
                if (currentOptions.length === 4) {
                    questions.push({
                        id: questions.length + 1,
                        question: language === 'en' ? 
                            { hi: currentQuestion, en: currentQuestion } : 
                            { hi: currentQuestion, en: currentQuestion },
                        options: language === 'en' ? 
                            { hi: currentOptions, en: currentOptions } : 
                            { hi: currentOptions, en: currentOptions },
                        correct: 0,
                        marks: 1,
                        difficulty: 'medium'
                    });
                    currentQuestion = '';
                    currentOptions = [];
                    questionStarted = false;
                }
            } else if (numberMatch) {
                // This is a numbered item - it's part of the question text
                if (currentQuestion) {
                    currentQuestion += ' ' + numberMatch[2];
                } else {
                    currentQuestion = numberMatch[2];
                    questionStarted = true;
                }
            } else if (!optionMatch && line.length > 2) {
                // Regular text - add to current question
                if (currentQuestion) {
                    currentQuestion += ' ' + line;
                } else if (!questionStarted) {
                    currentQuestion = line;
                    questionStarted = true;
                }
            }
        }
    }
    
    return questions;
}

'''

# Insert the new function before parseQuestionsFromText
content = content.replace('// Question parsing functions\nfunction parseQuestionsFromText', 
                         '// Question parsing functions\n' + parse_numbered_func + '\nfunction parseQuestionsFromText')

# Now update the parseQuestionsFromText function to use the new helper
old_strategy1 = '''    // Try multiple parsing strategies
    
    // Strategy 1: Split by question numbers (Q1, Q2, 1., 2., etc.)
    const questionBlocks = text.split(/(?=(?:Q|प्र|प्रश्न|Question)?\\s*[\\.\\):]?\\s*\\d+[\\.\\):])/i);
    
    for (let i = 0; i < questionBlocks.length; i++) {
        const block = questionBlocks[i].trim();
        if (block.length < 10) continue;
        
        const questionData = extractQuestionParts(block, i + 1, language);
        if (questionData) {
            questions.push(questionData);
        }
    }
    
    // Strategy 2: If no questions found, try splitting by double newlines'''

new_strategy1 = '''    // Try multiple parsing strategies
    
    // Strategy 1: Look for "Q1:" or "Q1." patterns followed by numbered questions with options
    const qBlocks = text.split(/Q\\d+:/i);
    
    for (let i = 1; i < qBlocks.length; i++) {
        const block = qBlocks[i].trim();
        if (block.length < 10) continue;
        
        // Parse this Q block which may contain multiple numbered questions
        const numberedQuestions = parseNumberedQuestions(block, language);
        questions.push(...numberedQuestions);
    }
    
    // Strategy 2: If no Q blocks found, split by question numbers (1., 2., etc.)
    if (questions.length === 0) {
        const numberedQuestions = parseNumberedQuestions(text, language);
        questions.push(...numberedQuestions);
    }
    
    // Strategy 3: If no questions found, try splitting by double newlines'''

content = content.replace(old_strategy1, new_strategy1)

# Also update "Strategy 3:" to "Strategy 4:" since we added a new strategy
content = content.replace('    // Strategy 3: If still no questions, try line-by-line', 
                         '    // Strategy 4: If still no questions, try line-by-line')

# Write the updated content
with open('server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("✓ server.js updated successfully")
