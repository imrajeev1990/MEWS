// Improved question parsing function for Hindi text with numbered questions
function parseNumberedQuestions(text, language) {
    const questions = [];
    
    // Split by numbered patterns like "1.", "2.", etc. but keep the number
    const parts = text.split(/(?=\d+\.\s)/);
    
    for (let part of parts) {
        part = part.trim();
        if (part.length < 10) continue;
        
        // Match pattern: "1. Question text? 2. Another question? 3. ..."
        // Look for sentences ending with ? followed by a number
        const lines = part.split('\n');
        let currentQuestion = '';
        let currentOptions = [];
        let questionStarted = false;
        
        for (let line of lines) {
            line = line.trim();
            if (!line) continue;
            
            // Check if this is a numbered item (like "1. ", "2. ", etc.)
            const numberMatch = line.match(/^(\d+)\.\s*(.+)$/);
            
            // Check if this is an option line
            const optionMatch = line.match(/^[(\[]?([A-Da-d])[\])][\.\):]?\s*(.+)$/);
            
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

// Add this to server.js before the parseQuestionsFromText function
