const express = require('express');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const app = express();
const PORT = 8080;

// Server logs storage (in-memory for now)
const serverLogs = [];
const MAX_LOGS = 1000; // Keep last 1000 logs

// Custom logging function
function logToConsole(type, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        type, // 'info', 'error', 'warn', 'success', 'delete'
        message,
        data: data ? JSON.stringify(data, null, 2) : null
    };
    
    // Add to in-memory logs
    serverLogs.push(logEntry);
    if (serverLogs.length > MAX_LOGS) {
        serverLogs.shift(); // Remove oldest log
    }
    
    // Also log to console
    const emoji = {
        'info': 'ℹ️',
        'error': '❌',
        'warn': '⚠️',
        'success': '✅',
        'delete': '🗑️'
    }[type] || '📝';
    
    console.log(`${emoji} [${new Date().toLocaleTimeString()}] ${message}`);
    if (data) {
        console.log(data);
    }
}

// Override console.log for delete operations
const originalConsoleLog = console.log;
console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    
    // Capture DELETE ALL logs
    const message = args.join(' ');
    if (message.includes('[DELETE ALL]')) {
        const logType = message.includes('Successfully') ? 'success' : 
                       message.includes('Error') || message.includes('Failed') ? 'error' : 'info';
        serverLogs.push({
            timestamp: new Date().toISOString(),
            type: logType,
            message: message,
            data: null
        });
        if (serverLogs.length > MAX_LOGS) {
            serverLogs.shift();
        }
    }
};

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
    // Log all DELETE requests
    if (req.method === 'DELETE') {
        logToConsole('info', `DELETE request: ${req.method} ${req.path}`);
        console.log(`[REQUEST] ${req.method} ${req.path}`);
    }
    next();
});

// Set UTF-8 encoding for all responses
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    next();
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Allow PDF and DOC/DOCX files
        if (file.mimetype === 'application/pdf' || 
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            file.mimetype === 'application/msword') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and DOC/DOCX files are allowed!'), false);
        }
    },
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Data paths
const DATA_DIR = path.join(__dirname, 'data');
const SUBJECTS_FILE = path.join(DATA_DIR, 'subjects.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const STUDENTS_FILE = path.join(DATA_DIR, 'students.json');
const RESULTS_FILE = path.join(DATA_DIR, 'results.json');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');

// Question parsing functions

// Function to normalize Hindi text from different fonts/encodings
function normalizeHindiText(text) {
    if (!text) return '';
    
    // Ensure the text is properly decoded as UTF-8
    // This helps with Mangal, Devanagari Unicode fonts
    try {
        // Normalize Unicode characters (NFC normalization)
        text = text.normalize('NFC');
        
        // Remove any zero-width characters that might cause issues
        text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');
        
        // Normalize common Hindi punctuation variations
        text = text.replace(/।/g, '।'); // Devanagari Danda
        text = text.replace(/॥/g, '॥'); // Devanagari Double Danda
        
        // Handle any BOMs or special markers
        text = text.replace(/^\uFEFF/, '');
        
        // Normalize whitespace but preserve structure
        text = text.replace(/\r\n/g, '\n');
        text = text.replace(/\r/g, '\n');
        
        // Remove excessive spaces but keep single spaces
        text = text.replace(/[ \t]+/g, ' ');
        
        // Preserve line breaks for structure
        text = text.replace(/\n{3,}/g, '\n\n');
        
    } catch (error) {
        console.error('Text normalization error:', error);
    }
    
    return text;
}

function parseNumberedQuestions(text, language) {
    const questions = [];
    
    // Strategy: Split text into segments by question numbers
    // Handle both multi-line and inline formats
    
    // First, normalize the text - replace common inline separators
    let normalizedText = text
        .replace(/Answer:\s*[A-D]/gi, '') // Remove Answer: A/B/C/D markers
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
    
    // Split by question numbers (1. 2. 3. etc.)
    const questionSegments = normalizedText.split(/(?=\d+[\.\)]\s)/);
    
    for (let segment of questionSegments) {
        segment = segment.trim();
        if (segment.length < 10) continue;
        
        // Extract question number and text
        const questionMatch = segment.match(/^(\d+)[\.\)]\s*(.+)$/s);
        if (!questionMatch) continue;
        
        const questionNumber = questionMatch[1];
        let remainingText = questionMatch[2].trim();
        
        // Try to extract options from the text
        // Pattern: A) text B) text C) text D) text
        // Or: A. text B. text C. text D. text
        // Or even: AतextBतextCतextDtext (no separators)
        
        const options = [];
        let questionText = '';
        
        // Try to split by the pattern A) B) C) D)
        // Look for: A) text B) text C) text D) text
        const optionSplitPattern = /([A-D])\s*\)\s*/gi;
        
        // First, find where options start
        const firstOptionMatch = remainingText.match(/([A-D])\s*\)/i);
        
        if (firstOptionMatch) {
            const firstOptionIndex = remainingText.indexOf(firstOptionMatch[0]);
            
            // Everything before first option is question text
            if (firstOptionIndex > 0) {
                questionText = remainingText.substring(0, firstOptionIndex).trim();
                // Ensure question ends with ?
                if (!questionText.endsWith('?')) {
                    questionText += '?';
                }
            }
            
            // Get the options part
            const optionsText = remainingText.substring(firstOptionIndex);
            
            // Split by option markers A) B) C) D)
            const optionParts = optionsText.split(/[A-D]\s*\)/i);
            
            // Skip first part (empty) and collect next 4 parts
            for (let j = 1; j < optionParts.length && options.length < 4; j++) {
                let optText = optionParts[j].trim();
                
                // Remove "Answer: X" markers
                optText = optText.replace(/Answer\s*:\s*[A-D].*$/i, '').trim();
                
                // Stop at next question number
                const nextQMatch = optText.match(/\d+[\.\)]\s/);
                if (nextQMatch) {
                    optText = optText.substring(0, optText.indexOf(nextQMatch[0])).trim();
                }
                
                if (optText.length > 0 && optText.length < 300) {
                    options.push(optText);
                }
            }
        } else {
            // No options found, just use text as question
            questionText = remainingText.split('\n')[0].trim();
            if (!questionText.endsWith('?')) {
                questionText += '?';
            }
        }
        
        // Create question if we have valid data
        if (questionText.length > 5 && options.length === 4) {
            questions.push({
                id: questions.length + 1,
                question: language === 'en' ? 
                    { hi: questionText, en: questionText } : 
                    { hi: questionText, en: questionText },
                options: language === 'en' ? 
                    { hi: options, en: options } : 
                    { hi: options, en: options },
                correct: 0,
                marks: 1,
                difficulty: 'medium'
            });
            console.log(`✅ Extracted Q${questionNumber}: ${questionText.substring(0, 50)}... with ${options.length} options`);
        } else {
            console.log(`⚠️  Question ${questionNumber}: Incomplete - text=${questionText.length}chars, options=${options.length}`);
        }
    }
    
    return questions;
}


function parseQuestionsFromText(text, language = 'hi') {
    const questions = [];
    
    // Clean and normalize text
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Try multiple parsing strategies
    
    // Strategy 1: Look for "Q1:" or "Q1." patterns followed by numbered questions with options
    const qBlocks = text.split(/Q\d+:/i);
    
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
    
    // Strategy 3: If no questions found, try splitting by double newlines
    if (questions.length === 0) {
        const blocks = text.split(/\n\s*\n/);
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i].trim();
            if (block.length < 20) continue;
            
            const questionData = extractQuestionParts(block, i + 1, language);
            if (questionData) {
                questions.push(questionData);
            }
        }
    }
    
    // Strategy 4: If still no questions, try line-by-line with option detection
    if (questions.length === 0) {
        const lines = text.split('\n');
        let currentQuestion = '';
        let currentOptions = [];
        let questionCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Check if line is an option (A), B), a), etc.)
            const optionMatch = line.match(/^[(\[]?([A-Da-d])[\])][\.\):]?\s*(.+)$/);
            if (optionMatch && currentQuestion) {
                currentOptions.push(optionMatch[2].trim());
                
                // If we have 4 options, create a question
                if (currentOptions.length === 4) {
                    questionCount++;
                    questions.push({
                        id: questionCount,
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
                }
            } else if (line.length > 10 && !optionMatch) {
                // This might be a question text
                if (currentQuestion) {
                    currentQuestion += ' ' + line;
                } else {
                    currentQuestion = line;
                }
            }
        }
    }
    
    return questions;
}

function extractQuestionParts(text, id, language) {
    // Clean the text - remove question number prefix
    text = text.replace(/^(?:Q|à¤ªà¥à¤°|à¤ªà¥à¤°à¤¶à¥à¤¨|Question)?\s*[\.\):]?\s*\d+[\.\):]?\s*/i, '').trim();
    
    // Extended option patterns to match more formats
    // Extended option patterns to match more formats
    // Support for Devanagari, Mangal, Kruti Dev, and all Hindi fonts
    const optionPatterns = [
        /^([A-D])\)\s*([^\n]+)/gm,                    // A) Option
        /^\(([A-D])\)\s*([^\n]+)/gm,                  // (A) Option
        /^\[([A-D])\]\s*([^\n]+)/gm,                  // [A] Option
        /^\{([A-D])\}\s*([^\n]+)/gm,                  // {A} Option
        /^([A-D])[\.\:]\s*([^\n]+)/gm,                // A. Option or A: Option
        /^([abcd])\)\s*([^\n]+)/gm,                   // a) Option
        /^\(([abcd])\)\s*([^\n]+)/gm,                 // (a) Option
        /^([०-९१-४])\)\s*([^\n]+)/gm,                 // Hindi numerals (Devanagari)
        /^([१-४])\)\s*([^\n]+)/gm,                    // Hindi numerals 1-4
        /^विकल्प\s*([A-D])[:\.\)]\s*([^\n]+)/gm,       // विकल्प A) Option
        /^Option\s*([A-D])[:\.\)]\s*([^\n]+)/gm,      // Option A) text
        /^([A-D])[\)\.\:][\s\u00A0\u200B]+([^\n]+)/gm // With special spaces
    ];
    
    let questionText = '';
    let options = [];
    let correctAnswer = 0;
    
    // Try each pattern
    for (const pattern of optionPatterns) {
        pattern.lastIndex = 0; // Reset regex
        const optionMatches = [...text.matchAll(pattern)];
        
        if (optionMatches.length >= 2) {
            // Find where first option starts
            const firstOptionIndex = text.search(pattern);
            questionText = text.substring(0, firstOptionIndex).trim();
            
            // Extract option texts
            options = optionMatches.map(match => match[2].trim());
            
            // Look for answer indication (more flexible patterns)
            const answerPatterns = [
                /(?:à¤‰à¤¤à¥à¤¤à¤°|Answer|Ans|Correct|à¤¸à¤¹à¥€ à¤‰à¤¤à¥à¤¤à¤°)[\s:]*([A-Da-dà¥§-à¥ª])/i,
                /(?:Answer|à¤‰à¤¤à¥à¤¤à¤°)[\s:]*[\(\[]?([A-Da-d])[\)\]]?/i,
                /\*\*([A-Da-d])\*\*/,  // **A** format
                /\b([A-D])\s*(?:is|à¤¹à¥ˆ)\s*(?:correct|à¤¸à¤¹à¥€)/i
            ];
            
            for (const ansPattern of answerPatterns) {
                const answerMatch = text.match(ansPattern);
                if (answerMatch) {
                    let answerLetter = answerMatch[1].toUpperCase();
                    // Handle Hindi numerals
                    if (answerLetter === 'à¥§') answerLetter = 'A';
                    else if (answerLetter === 'à¥¨') answerLetter = 'B';
                    else if (answerLetter === 'à¥©') answerLetter = 'C';
                    else if (answerLetter === 'à¥ª') answerLetter = 'D';
                    
                    correctAnswer = Math.min(answerLetter.charCodeAt(0) - 'A'.charCodeAt(0), options.length - 1);
                    break;
                }
            }
            
            break;
        }
    }
    
    // Fallback: If no structured options found, try line-by-line
    if (options.length === 0) {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length >= 3) {
            questionText = lines[0];
            // Take next lines as options (up to 4)
            for (let i = 1; i < lines.length && options.length < 4; i++) {
                const line = lines[i];
                // Skip lines that look like metadata
                if (line.length > 3 && line.length < 200 && 
                    !line.match(/^(?:Answer|à¤‰à¤¤à¥à¤¤à¤°|Marks|à¤…à¤‚à¤•|Difficulty)/i)) {
                    // Remove any leading symbols/numbers
                    const cleanLine = line.replace(/^[\d\.\)\(\[\]]+\s*/, '').trim();
                    if (cleanLine.length > 2) {
                        options.push(cleanLine);
                    }
                }
            }
        }
    }
    
    // Validate we have minimum required parts
    if (!questionText || questionText.length < 5 || options.length < 2) {
        return null;
    }
    
    // Create question object with bilingual support
    const questionObj = {
        id: id,
        question: language === 'en' ? 
            { hi: questionText, en: questionText } : 
            { hi: questionText, en: questionText },
        options: language === 'en' ? 
            { hi: options, en: options } : 
            { hi: options, en: options },
        correct: correctAnswer,
        marks: 1,
        difficulty: 'medium'
    };
    
    return questionObj;
}

// Initialize data files if they don't exist
function initializeData() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    // Default subjects
    const defaultSubjects = [
        {
            id: 'bs-cit',
            name: 'Bihar State - Certificate in Information Technology (BS-CIT)',
            shortName: 'BS-CIT',
            duration: 30, // minutes
            totalMarks: 20
        },
        {
            id: 'language-skill',
            name: 'Bihar State - Certificate in Language Skill',
            shortName: 'Language Skill',
            duration: 25,
            totalMarks: 15
        },
        {
            id: 'soft-skills',
            name: 'Bihar State - Certificate in Soft Skills',
            shortName: 'Soft Skills',
            duration: 25,
            totalMarks: 15
        },
        {
            id: 'bs-cfa',
            name: 'Bihar State - Certificate in Financial Accounting (BS-CFA)',
            shortName: 'BS-CFA',
            duration: 35,
            totalMarks: 25
        }
    ];

    // Default questions (Bilingual support)
    const defaultQuestions = {
        'bs-cit': [
            {
                id: 1,
                question: {
                    hi: "à¤•à¤‚à¤ªà¥à¤¯à¥‚à¤Ÿà¤° à¤•à¤¾ à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤® à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?",
                    en: "What is the full form of COMPUTER?"
                },
                options: {
                    hi: [
                        "Common Operating Machine",
                        "Computer Operated Machine", 
                        "Common Operating Machine Particularly Used for Trade",
                        "Commonly Operated Machine Particularly Used for Technical Research"
                    ],
                    en: [
                        "Common Operating Machine",
                        "Computer Operated Machine", 
                        "Common Operating Machine Particularly Used for Trade",
                        "Commonly Operated Machine Particularly Used for Technical Research"
                    ]
                },
                correct: 2,
                marks: 1,
                difficulty: 'easy'
            },
            {
                id: 2,
                question: {
                    hi: "MS Word à¤®à¥‡à¤‚ à¤•à¤¿à¤¸ shortcut key à¤¸à¥‡ Save à¤•à¤°à¤¤à¥‡ à¤¹à¥ˆà¤‚?",
                    en: "Which shortcut key is used to Save in MS Word?"
                },
                options: {
                    hi: ["Ctrl+S", "Ctrl+A", "Ctrl+C", "Ctrl+V"],
                    en: ["Ctrl+S", "Ctrl+A", "Ctrl+C", "Ctrl+V"]
                },
                correct: 0,
                marks: 1,
                difficulty: 'easy'
            },
            {
                id: 3,
                question: "Internet à¤®à¥‡à¤‚ WWW à¤•à¤¾ à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤® à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?",
                options: [
                    "World Wide Web",
                    "World Wide Website", 
                    "World Web Wide",
                    "Wide World Web"
                ],
                correct: 0,
                marks: 1,
                difficulty: 'medium'
            }
        ],
        'language-skill': [
            {
                id: 1,
                question: "à¤¨à¤¿à¤®à¥à¤¨à¤²à¤¿à¤–à¤¿à¤¤ à¤®à¥‡à¤‚ à¤¸à¥‡ à¤•à¥Œà¤¨ à¤¸à¤¾ à¤µà¤¾à¤•à¥à¤¯ à¤¶à¥à¤¦à¥à¤§ à¤¹à¥ˆ?",
                options: [
                    "à¤®à¥ˆà¤‚ à¤ªà¤¾à¤¨à¥€ à¤ªà¥€à¤¤à¤¾ à¤¹à¥‚à¤",
                    "à¤®à¥ˆà¤‚ à¤ªà¤¾à¤¨à¥€ à¤ªà¥€à¤¤à¤¾ à¤¹à¥ˆ", 
                    "à¤®à¥ˆà¤‚ à¤ªà¤¾à¤¨à¥€ à¤ªà¥€à¤¤à¥€ à¤¹à¥‚à¤",
                    "à¤®à¥ˆà¤‚ à¤ªà¤¾à¤¨à¥€ à¤ªà¥€à¤¤à¥‡ à¤¹à¥ˆà¤‚"
                ],
                correct: 0,
                marks: 1,
                difficulty: 'easy'
            },
            {
                id: 2,
                question: "'à¤…à¤¨à¥à¤°à¤¾à¤—' à¤¶à¤¬à¥à¤¦ à¤•à¤¾ à¤µà¤¿à¤²à¥‹à¤® à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?",
                options: ["à¤ªà¥à¤°à¥‡à¤®", "à¤µà¤¿à¤°à¤¾à¤—", "à¤¸à¥à¤¨à¥‡à¤¹", "à¤­à¤•à¥à¤¤à¤¿"],
                correct: 1,
                marks: 1,
                difficulty: 'medium'
            }
        ],
        'soft-skills': [
            {
                id: 1,
                question: "Communication Skills à¤•à¤¾ à¤®à¤¤à¤²à¤¬ à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?",
                options: [
                    "à¤¬à¤¾à¤¤à¤šà¥€à¤¤ à¤•à¤°à¤¨à¤¾",
                    "à¤¸à¤‚à¤µà¤¾à¤¦ à¤•à¥Œà¤¶à¤²", 
                    "à¤«à¥‹à¤¨ à¤ªà¤° à¤¬à¤¾à¤¤ à¤•à¤°à¤¨à¤¾",
                    "à¤šà¤¿à¤Ÿà¥à¤ à¥€ à¤²à¤¿à¤–à¤¨à¤¾"
                ],
                correct: 1,
                marks: 1,
                difficulty: 'easy'
            },
            {
                id: 2,
                question: "Team Work à¤®à¥‡à¤‚ à¤¸à¤¬à¤¸à¥‡ à¤®à¤¹à¤¤à¥à¤µà¤ªà¥‚à¤°à¥à¤£ à¤šà¥€à¤œ à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?",
                options: [
                    "à¤…à¤•à¥‡à¤²à¥‡ à¤•à¤¾à¤® à¤•à¤°à¤¨à¤¾",
                    "à¤¸à¤¹à¤¯à¥‹à¤— à¤•à¤°à¤¨à¤¾", 
                    "à¤•à¥‡à¤µà¤² à¤…à¤ªà¤¨à¤¾ à¤•à¤¾à¤® à¤•à¤°à¤¨à¤¾",
                    "à¤¦à¥‚à¤¸à¤°à¥‹à¤‚ à¤ªà¤° à¤¨à¤¿à¤°à¥à¤­à¤° à¤°à¤¹à¤¨à¤¾"
                ],
                correct: 1,
                marks: 1,
                difficulty: 'medium'
            }
        ],
        'bs-cfa': [
            {
                id: 1,
                question: {
                    hi: "Accounting à¤®à¥‡à¤‚ Debit à¤•à¤¾ à¤®à¤¤à¤²à¤¬ à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?",
                    en: "What does Debit mean in Accounting?"
                },
                options: {
                    hi: [
                        "à¤¨à¤¾à¤®à¥‡ (à¤¬à¤¾à¤à¤‚ à¤¤à¤°à¤« à¤•à¥€ entry)",
                        "à¤œà¤®à¤¾ (à¤¦à¤¾à¤à¤‚ à¤¤à¤°à¤« à¤•à¥€ entry)",
                        "à¤•à¥‡à¤µà¤² à¤–à¤°à¥à¤š",
                        "à¤•à¥‡à¤µà¤² à¤†à¤¯"
                    ],
                    en: [
                        "Left side entry", 
                        "Right side entry",
                        "Expense only",
                        "Income only"
                    ]
                },
                correct: 0,
                marks: 1,
                difficulty: 'easy'
            },
            {
                id: 2,
                question: {
                    hi: "Balance Sheet à¤®à¥‡à¤‚ Assets à¤”à¤° Liabilities à¤•à¤¾ à¤•à¥à¤¯à¤¾ relation à¤¹à¥ˆ?",
                    en: "What is the relation between Assets and Liabilities in Balance Sheet?"
                },
                options: {
                    hi: [
                        "Assets = Liabilities + Capital",
                        "Assets = Liabilities - Capital", 
                        "Assets + Liabilities = Capital",
                        "Assets - Liabilities = 0"
                    ],
                    en: [
                        "Assets = Liabilities + Capital",
                        "Assets = Liabilities - Capital", 
                        "Assets + Liabilities = Capital",
                        "Assets - Liabilities = 0"
                    ]
                },
                correct: 0,
                marks: 1,
                difficulty: 'medium'
            },
            {
                id: 3,
                question: {
                    hi: "Cash Book à¤®à¥‡à¤‚ à¤•à¥Œà¤¨ à¤¸à¥‡ transactions record à¤¹à¥‹à¤¤à¥‡ à¤¹à¥ˆà¤‚?",
                    en: "Which transactions are recorded in Cash Book?"
                },
                options: {
                    hi: [
                        "à¤•à¥‡à¤µà¤² cash transactions",
                        "à¤•à¥‡à¤µà¤² bank transactions",
                        "Cash à¤”à¤° Bank à¤¦à¥‹à¤¨à¥‹à¤‚ transactions", 
                        "Credit transactions"
                    ],
                    en: [
                        "Only cash transactions",
                        "Only bank transactions", 
                        "Both Cash and Bank transactions",
                        "Credit transactions"
                    ]
                },
                correct: 2,
                marks: 1,
                difficulty: 'medium'
            },
            {
                id: 4,
                question: {
                    hi: "Trial Balance à¤¬à¤¨à¤¾à¤¨à¥‡ à¤•à¤¾ à¤®à¥à¤–à¥à¤¯ à¤‰à¤¦à¥à¤¦à¥‡à¤¶à¥à¤¯ à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?",
                    en: "What is the main purpose of preparing Trial Balance?"
                },
                options: {
                    hi: [
                        "Profit calculate à¤•à¤°à¤¨à¤¾",
                        "Accounting errors check à¤•à¤°à¤¨à¤¾",
                        "Tax calculate à¤•à¤°à¤¨à¤¾",
                        "Salary calculate à¤•à¤°à¤¨à¤¾"
                    ],
                    en: [
                        "To calculate profit",
                        "To check accounting errors", 
                        "To calculate tax",
                        "To calculate salary"
                    ]
                },
                correct: 1,
                marks: 1,
                difficulty: 'medium'
            },
            {
                id: 5,
                question: {
                    hi: "GST à¤•à¤¾ à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤® à¤•à¥à¤¯à¤¾ à¤¹à¥ˆ?",
                    en: "What is the full form of GST?"
                },
                options: {
                    hi: [
                        "Good Service Tax", 
                        "Goods and Services Tax",
                        "Government Service Tax",
                        "General Sales Tax"
                    ],
                    en: [
                        "Good Service Tax",
                        "Goods and Services Tax", 
                        "Government Service Tax", 
                        "General Sales Tax"
                    ]
                },
                correct: 1,
                marks: 1,
                difficulty: 'easy'
            }
        ]
    };

    // Initialize files
    if (!fs.existsSync(SUBJECTS_FILE)) {
        fs.writeFileSync(SUBJECTS_FILE, JSON.stringify(defaultSubjects, null, 2));
    }

    if (!fs.existsSync(QUESTIONS_FILE)) {
        fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(defaultQuestions, null, 2));
    }

    if (!fs.existsSync(STUDENTS_FILE)) {
        fs.writeFileSync(STUDENTS_FILE, JSON.stringify([], null, 2));
    }

    if (!fs.existsSync(RESULTS_FILE)) {
        fs.writeFileSync(RESULTS_FILE, JSON.stringify([], null, 2));
    }
}

// Helper functions
function readJSONFile(filepath) {
    try {
        const data = fs.readFileSync(filepath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading file:', filepath, error);
        return null;
    }
}

function writeJSONFile(filepath, data) {
    try {
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing file:', filepath, error);
        return false;
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Routes

// Admin Authentication Routes

// Get admin credentials (for login verification)
app.post('/api/admin/login', (req, res) => {
    try {
        const { username, password } = req.body;
        const adminData = readJSONFile(ADMIN_FILE);
        
        if (!adminData) {
            return res.status(500).json({ error: 'Admin data not found' });
        }
        
        if (username === adminData.username && password === adminData.password) {
            res.json({ 
                success: true, 
                message: 'Login successful',
                securityQuestion: adminData.securityQuestion 
            });
        } else {
            res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get security question (for forgot password)
app.get('/api/admin/security-question', (req, res) => {
    try {
        const adminData = readJSONFile(ADMIN_FILE);
        if (!adminData) {
            return res.status(500).json({ error: 'Admin data not found' });
        }
        res.json({ securityQuestion: adminData.securityQuestion });
    } catch (error) {
        console.error('Get security question error:', error);
        res.status(500).json({ error: 'Failed to get security question' });
    }
});

// Reset password using security answer
app.post('/api/admin/reset-password', (req, res) => {
    try {
        const { securityAnswer, newPassword } = req.body;
        const adminData = readJSONFile(ADMIN_FILE);
        
        if (!adminData) {
            return res.status(500).json({ error: 'Admin data not found' });
        }
        
        // Flexible matching - normalize and compare
        const normalizeAnswer = (str) => {
            return str.toLowerCase()
                .trim()
                .replace(/[^\w\s]/g, '') // Remove special characters
                .replace(/\s+/g, ' ');    // Normalize spaces
        };
        
        const userAnswer = normalizeAnswer(securityAnswer);
        const correctAnswer = normalizeAnswer(adminData.securityAnswer);
        
        // Check exact match or if user answer contains key words
        const isCorrect = userAnswer === correctAnswer || 
                         correctAnswer.includes(userAnswer) || 
                         userAnswer.includes(correctAnswer);
        
        if (isCorrect) {
            adminData.password = newPassword;
            writeJSONFile(ADMIN_FILE, adminData);
            res.json({ success: true, message: 'Password reset successfully' });
        } else {
            res.status(401).json({ success: false, error: 'Incorrect security answer' });
        }
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

// Change password (requires current password)
app.post('/api/admin/change-password', (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const adminData = readJSONFile(ADMIN_FILE);
        
        if (!adminData) {
            return res.status(500).json({ error: 'Admin data not found' });
        }
        
        if (currentPassword === adminData.password) {
            adminData.password = newPassword;
            writeJSONFile(ADMIN_FILE, adminData);
            res.json({ success: true, message: 'Password changed successfully' });
        } else {
            res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});

// Update security question
app.post('/api/admin/update-security', (req, res) => {
    try {
        const { currentPassword, securityQuestion, securityAnswer } = req.body;
        const adminData = readJSONFile(ADMIN_FILE);
        
        if (!adminData) {
            return res.status(500).json({ error: 'Admin data not found' });
        }
        
        if (currentPassword === adminData.password) {
            adminData.securityQuestion = securityQuestion;
            adminData.securityAnswer = securityAnswer;
            writeJSONFile(ADMIN_FILE, adminData);
            res.json({ success: true, message: 'Security question updated successfully' });
        } else {
            res.status(401).json({ success: false, error: 'Current password is incorrect' });
        }
    } catch (error) {
        console.error('Update security error:', error);
        res.status(500).json({ error: 'Failed to update security question' });
    }
});

// Get all subjects
app.get('/api/subjects', (req, res) => {
    const subjects = readJSONFile(SUBJECTS_FILE);
    if (subjects) {
        res.json(subjects);
    } else {
        res.status(500).json({ error: 'Failed to load subjects' });
    }
});

// Add new subject
app.post('/admin/subjects', (req, res) => {
    const { name, duration, description, showAnswers } = req.body;
    
    if (!name || !duration) {
        return res.status(400).json({ error: 'Name and duration are required' });
    }
    
    const subjects = readJSONFile(SUBJECTS_FILE) || [];
    
    // Generate ID from name
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Check if subject already exists
    if (subjects.find(s => s.id === id)) {
        return res.status(400).json({ error: 'Subject with this name already exists' });
    }
    
    const newSubject = {
        id,
        name: name.trim(),
        shortName: name.trim(),
        duration: parseInt(duration),
        description: description ? description.trim() : '',
        totalMarks: parseInt(duration), // Can be customized
        showAnswers: showAnswers !== undefined ? showAnswers : true // Default to true
    };
    
    subjects.push(newSubject);
    
    if (writeJSONFile(SUBJECTS_FILE, subjects)) {
        res.json({ success: true, message: 'Subject added successfully', subject: newSubject });
    } else {
        res.status(500).json({ error: 'Failed to save subject' });
    }
});

// Update subject
app.put('/admin/subjects/:id', (req, res) => {
    const { id } = req.params;
    const { name, duration, description, showAnswers } = req.body;
    
    const subjects = readJSONFile(SUBJECTS_FILE) || [];
    const subjectIndex = subjects.findIndex(s => s.id === id);
    
    if (subjectIndex === -1) {
        return res.status(404).json({ error: 'Subject not found' });
    }
    
    // If only showAnswers is being updated (toggle operation)
    if (showAnswers !== undefined && !name && !duration) {
        subjects[subjectIndex].showAnswers = showAnswers;
    } else {
        // Full update operation
        if (!name || !duration) {
            return res.status(400).json({ error: 'Name and duration are required' });
        }
        
        subjects[subjectIndex] = {
            ...subjects[subjectIndex],
            name: name.trim(),
            shortName: name.trim(),
            duration: parseInt(duration),
            description: description ? description.trim() : '',
            showAnswers: showAnswers !== undefined ? showAnswers : subjects[subjectIndex].showAnswers
        };
    }
    
    if (writeJSONFile(SUBJECTS_FILE, subjects)) {
        res.json({ success: true, message: 'Subject updated successfully', subject: subjects[subjectIndex] });
    } else {
        res.status(500).json({ error: 'Failed to update subject' });
    }
});

// Delete subject
app.delete('/admin/subjects/:id', (req, res) => {
    const { id } = req.params;
    
    const subjects = readJSONFile(SUBJECTS_FILE) || [];
    const subjectIndex = subjects.findIndex(s => s.id === id);
    
    if (subjectIndex === -1) {
        return res.status(404).json({ error: 'Subject not found' });
    }
    
    const deletedSubject = subjects[subjectIndex];
    subjects.splice(subjectIndex, 1);
    
    // Also delete all questions for this subject
    const allQuestions = readJSONFile(QUESTIONS_FILE) || {};
    if (allQuestions[id]) {
        delete allQuestions[id];
        writeJSONFile(QUESTIONS_FILE, allQuestions);
    }
    
    if (writeJSONFile(SUBJECTS_FILE, subjects)) {
        res.json({ success: true, message: 'Subject deleted successfully', subject: deletedSubject });
    } else {
        res.status(500).json({ error: 'Failed to delete subject' });
    }
});

// Get questions for a subject (shuffled)
app.get('/api/questions/:subjectId', (req, res) => {
    const { subjectId } = req.params;
    const { lang = 'hi' } = req.query; // Default to Hindi
    const allQuestions = readJSONFile(QUESTIONS_FILE);
    
    if (allQuestions && allQuestions[subjectId]) {
        // Filter questions by language if 'language' field exists
        let subjectQuestions = allQuestions[subjectId];
        
        // Filter by language tag if present
        const languageFilteredQuestions = subjectQuestions.filter(q => {
            // If question has a language field, only include matching language
            if (q.language) {
                return q.language === lang;
            }
            // If no language field, include all (bilingual questions)
            return true;
        });
        
        const questions = shuffleArray(languageFilteredQuestions);
        // Remove correct answers from response for security and apply language
        const questionsForClient = questions.map(q => {
            // Handle both old format (string) and new format (object with languages)
            let question, options;
            
            if (typeof q.question === 'object' && q.question !== null) {
                // Bilingual format
                question = q.question[lang] || q.question.hi || q.question.en || 'Question text not available';
            } else {
                // Old format - plain string
                question = q.question;
            }
            
            if (typeof q.options === 'object' && !Array.isArray(q.options) && q.options !== null) {
                // Bilingual format - options is an object with lang keys
                options = q.options[lang] || q.options.hi || q.options.en || [];
            } else if (Array.isArray(q.options)) {
                // Old format - options is already an array
                options = q.options;
            } else {
                options = [];
            }            return {
                id: q.id,
                question: question,
                options: options,
                marks: q.marks,
                correct: q.correct
            };
        });
        res.json(questionsForClient);
    } else {
        res.status(404).json({ error: 'Subject not found or no questions available' });
    }
});

// Register student
app.post('/api/register', (req, res) => {
    const { name, email, mobile, subject } = req.body;
    
    if (!name || !email || !mobile || !subject) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const students = readJSONFile(STUDENTS_FILE) || [];
    const studentId = Date.now().toString();
    
    const newStudent = {
        id: studentId,
        name,
        email,
        mobile,
        subject,
        registrationTime: new Date().toISOString()
    };

    students.push(newStudent);
    
    if (writeJSONFile(STUDENTS_FILE, students)) {
        res.json({ success: true, studentId, message: 'Registration successful' });
    } else {
        res.status(500).json({ error: 'Failed to register student' });
    }
});

// Submit exam
app.post('/api/submit', (req, res) => {
    const { studentId, subjectId, answers, timeSpent } = req.body;
    
    if (!studentId || !subjectId || !answers) {
        return res.status(400).json({ error: 'Missing required data' });
    }

    const students = readJSONFile(STUDENTS_FILE) || [];
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
        return res.status(404).json({ error: 'Student not found' });
    }

    const allQuestions = readJSONFile(QUESTIONS_FILE);
    if (!allQuestions || !allQuestions[subjectId]) {
        return res.status(404).json({ error: 'Questions not found' });
    }

    const questions = allQuestions[subjectId];
    let correctAnswers = 0;
    let totalMarks = 0;
    let obtainedMarks = 0;
    
    const resultDetails = questions.map(question => {
        const userAnswer = answers[question.id];
        const isCorrect = userAnswer !== undefined && userAnswer === question.correct;
        
        totalMarks += question.marks;
        if (isCorrect) {
            correctAnswers++;
            obtainedMarks += question.marks;
        }

        return {
            questionId: question.id,
            question: question.question,
            userAnswer: userAnswer !== undefined ? question.options[userAnswer] : 'Not Answered',
            correctAnswer: question.options[question.correct],
            isCorrect,
            marks: isCorrect ? question.marks : 0,
            totalMarks: question.marks
        };
    });

    const result = {
        id: Date.now().toString(),
        studentId,
        student: {
            name: student.name,
            email: student.email,
            mobile: student.mobile
        },
        subjectId,
        correctAnswers,
        totalQuestions: questions.length,
        obtainedMarks,
        totalMarks,
        percentage: Math.round((obtainedMarks / totalMarks) * 100),
        timeSpent,
        submissionTime: new Date().toISOString(),
        details: resultDetails
    };

    const results = readJSONFile(RESULTS_FILE) || [];
    results.push(result);

    if (writeJSONFile(RESULTS_FILE, results)) {
        res.json({ success: true, result });
    } else {
        res.status(500).json({ error: 'Failed to save result' });
    }
});

// Admin page route
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve format guide
app.get('/QUESTION_FORMAT_GUIDE.md', (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(path.join(__dirname, 'QUESTION_FORMAT_GUIDE.md'));
});

// Format guide as HTML page
app.get('/format-guide', (req, res) => {
    try {
        const guideContent = fs.readFileSync(path.join(__dirname, 'QUESTION_FORMAT_GUIDE.md'), 'utf8');
        const htmlContent = `
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Question Format Guide - KYP Exam System</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        code { background: #e9ecef; padding: 2px 5px; border-radius: 3px; }
        .success { color: #27ae60; font-weight: bold; }
        .error { color: #e74c3c; font-weight: bold; }
        .back-btn {
            display: inline-block;
            padding: 10px 20px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-bottom: 20px;
        }
        .back-btn:hover { background: #2980b9; }
    </style>
</head>
<body>
    <div class="container">
        <a href="/admin" class="back-btn">â† Back to Admin Panel</a>
        <pre>${guideContent}</pre>
    </div>
</body>
</html>`;
        res.send(htmlContent);
    } catch (error) {
        res.status(500).send('Error loading format guide');
    }
});

// File upload and question extraction endpoint
app.post('/api/admin/upload-questions', upload.single('questionFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const { subjectId, language = 'hi' } = req.body;
        if (!subjectId) {
            return res.status(400).json({ error: 'Subject ID is required' });
        }
        
        let extractedText = '';
        const filePath = req.file.path;
        const fileExtension = path.extname(req.file.originalname).toLowerCase();
        
        // Extract text based on file type
        if (fileExtension === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            extractedText = pdfData.text;
        } else if (fileExtension === '.docx' || fileExtension === '.doc') {
            // Use mammoth with options to preserve formatting and handle all Unicode
            const result = await mammoth.extractRawText({ 
                path: filePath,
                convertImage: mammoth.images.inline(function(element) {
                    return element.read("base64").then(function(imageBuffer) {
                        return {
                            src: "data:" + element.contentType + ";base64," + imageBuffer
                        };
                    });
                })
            });
            extractedText = result.value;
            
            // Normalize text to handle different encodings (Kruti Dev, Mangal, etc.)
            extractedText = normalizeHindiText(extractedText);
        } else {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Unsupported file format' });
        }
        
        // Log extracted text for debugging (first 500 chars)
        console.log('Extracted text preview:', extractedText.substring(0, 500));
        
        // Parse questions from extracted text
        const parsedQuestions = parseQuestionsFromText(extractedText, language);
        
        if (parsedQuestions.length === 0) {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            return res.status(400).json({ 
                error: 'No questions found in the document. Please check the format.',
                extractedText: extractedText.substring(0, 500) + '...' // First 500 chars for debugging
            });
        }
        
        // Load existing questions
        const allQuestions = readJSONFile(QUESTIONS_FILE) || {};
        if (!allQuestions[subjectId]) {
            allQuestions[subjectId] = [];
        }
        
        // Add new questions with unique IDs
        const maxId = allQuestions[subjectId].length > 0 ? 
            Math.max(...allQuestions[subjectId].map(q => q.id)) : 0;
        
        parsedQuestions.forEach((question, index) => {
            question.id = maxId + index + 1;
            // Add language tag based on selected language
            question.language = language;
            allQuestions[subjectId].push(question);
        });
        
        // Save questions
        if (writeJSONFile(QUESTIONS_FILE, allQuestions)) {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            
            res.json({
                success: true,
                message: `Successfully imported ${parsedQuestions.length} questions`,
                questionsAdded: parsedQuestions.length,
                questions: parsedQuestions.map(q => ({
                    id: q.id,
                    question: typeof q.question === 'object' ? q.question[language] : q.question,
                    optionsCount: Array.isArray(q.options) ? q.options.length : 
                                  (typeof q.options === 'object' ? q.options[language]?.length || 0 : 0)
                }))
            });
        } else {
            // Clean up uploaded file
            fs.unlinkSync(filePath);
            res.status(500).json({ error: 'Failed to save questions to database' });
        }
        
    } catch (error) {
        // Clean up uploaded file if it exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        console.error('Question upload error:', error);
        res.status(500).json({ 
            error: 'Failed to process file: ' + error.message,
            details: error.stack 
        });
    }
});

// Admin routes

// Get all questions (admin only)
app.get('/api/admin/questions', (req, res) => {
    const questions = readJSONFile(QUESTIONS_FILE);
    if (questions) {
        res.json(questions);
    } else {
        res.status(500).json({ error: 'Failed to load questions' });
    }
});

// Add question
app.post('/api/admin/questions', (req, res) => {
    const { subjectId, question, options, correct, marks, difficulty } = req.body;
    
    logToConsole('info', `[ADD QUESTION] Adding question to exam: ${subjectId}`);
    
    if (!subjectId || !question || !options || correct === undefined || !marks) {
        logToConsole('error', '[ADD QUESTION] Missing required fields');
        return res.status(400).json({ error: 'All fields are required' });
    }

    const allQuestions = readJSONFile(QUESTIONS_FILE) || {};
    
    if (!allQuestions[subjectId]) {
        allQuestions[subjectId] = [];
        logToConsole('info', `[ADD QUESTION] Creating new question array for ${subjectId}`);
    }

    const newQuestion = {
        id: Date.now(),
        question,
        options,
        correct: parseInt(correct),
        marks: parseInt(marks),
        difficulty: difficulty || 'medium'
    };

    allQuestions[subjectId].push(newQuestion);
    const totalQuestions = allQuestions[subjectId].length;

    if (writeJSONFile(QUESTIONS_FILE, allQuestions)) {
        logToConsole('success', `[ADD QUESTION] Question added successfully. Total questions for ${subjectId}: ${totalQuestions}`);
        res.json({ success: true, message: 'Question added successfully' });
    } else {
        logToConsole('error', '[ADD QUESTION] Failed to write to file');
        res.status(500).json({ error: 'Failed to add question' });
    }
});

// Update/Edit question
app.put('/api/admin/questions/:subjectId/:questionId(\\d+)', (req, res) => {
    const { subjectId, questionId } = req.params;
    const updatedQuestion = req.body;
    const allQuestions = readJSONFile(QUESTIONS_FILE) || {};
    
    if (!allQuestions[subjectId]) {
        return res.status(404).json({ error: 'Subject not found' });
    }
    
    const questionIndex = allQuestions[subjectId].findIndex(q => q.id == questionId);
    
    if (questionIndex === -1) {
        return res.status(404).json({ error: 'Question not found' });
    }
    
    // Keep the original ID and update other fields
    allQuestions[subjectId][questionIndex] = {
        ...updatedQuestion,
        id: parseInt(questionId)
    };
    
    if (writeJSONFile(QUESTIONS_FILE, allQuestions)) {
        res.json({ success: true, message: 'Question updated successfully', question: allQuestions[subjectId][questionIndex] });
    } else {
        res.status(500).json({ error: 'Failed to update question' });
    }
});

// Delete all questions for a subject (MUST BE BEFORE single question delete!)
app.delete('/api/admin/questions/:subjectId/delete-all', (req, res) => {
    const { subjectId } = req.params;
    
    logToConsole('delete', `[DELETE ALL] Request received for subject: ${subjectId}`);
    console.log(`[DELETE ALL] ==========================================`);
    console.log(`[DELETE ALL] Request received for subject: ${subjectId}`);
    console.log(`[DELETE ALL] Full URL: ${req.url}`);
    console.log(`[DELETE ALL] Params:`, req.params);
    
    const allQuestions = readJSONFile(QUESTIONS_FILE) || {};
    console.log(`[DELETE ALL] Available subjects:`, Object.keys(allQuestions));

    if (!allQuestions[subjectId]) {
        logToConsole('error', `[DELETE ALL] Subject not found: ${subjectId}`);
        console.log(`[DELETE ALL] Subject not found: ${subjectId}`);
        console.log(`[DELETE ALL] Looking for '${subjectId}' but only have:`, Object.keys(allQuestions));
        return res.status(404).json({ error: 'Subject not found' });
    }

    const deletedCount = allQuestions[subjectId].length;
    logToConsole('info', `[DELETE ALL] Found ${deletedCount} questions to delete`);
    console.log(`[DELETE ALL] Found ${deletedCount} questions to delete`);
    
    if (deletedCount === 0) {
        logToConsole('info', `[DELETE ALL] No questions to delete for ${subjectId}`);
        console.log(`[DELETE ALL] No questions to delete for ${subjectId}`);
        return res.json({ success: true, message: 'No questions to delete', deletedCount: 0 });
    }

    // Create backup before deleting
    const backupFile = QUESTIONS_FILE + '.backup';
    try {
        fs.copyFileSync(QUESTIONS_FILE, backupFile);
        logToConsole('success', `[DELETE ALL] Backup created`);
        console.log(`[DELETE ALL] Backup created at ${backupFile}`);
    } catch (backupError) {
        logToConsole('warn', `[DELETE ALL] Could not create backup: ${backupError.message}`);
        console.warn(`[DELETE ALL] Could not create backup: ${backupError.message}`);
    }
    
    // Clear all questions for this subject
    allQuestions[subjectId] = [];
    
    logToConsole('info', `[DELETE ALL] Writing updated questions to file...`);
    console.log(`[DELETE ALL] Writing updated questions to file...`);
    console.log(`[DELETE ALL] Questions remaining in memory: ${JSON.stringify(Object.keys(allQuestions).map(key => ({subject: key, count: allQuestions[key].length})))}`);

    if (writeJSONFile(QUESTIONS_FILE, allQuestions)) {
        logToConsole('success', `[DELETE ALL] Successfully deleted ${deletedCount} questions from ${subjectId}`);
        console.log(`[DELETE ALL] Successfully deleted ${deletedCount} questions from ${subjectId}`);
        
        // Verify the file was written correctly
        const verifyRead = readJSONFile(QUESTIONS_FILE);
        const actualCount = verifyRead && verifyRead[subjectId] ? verifyRead[subjectId].length : 0;
        logToConsole('info', `[DELETE ALL] Verification: ${actualCount} questions remaining`);
        console.log(`[DELETE ALL] Verification: ${actualCount} questions remaining for ${subjectId}`);
        
        res.json({ 
            success: true, 
            message: `Successfully deleted all ${deletedCount} questions`,
            deletedCount: deletedCount,
            remainingCount: actualCount
        });
    } else {
        logToConsole('error', `[DELETE ALL] Failed to write to file for ${subjectId}`);
        console.error(`[DELETE ALL] Failed to write to file for ${subjectId}`);
        res.status(500).json({ error: 'Failed to delete questions' });
    }
});

// Delete single question (MUST BE AFTER delete-all to avoid route conflict!)
app.delete('/api/admin/questions/:subjectId/:questionId(\\d+)', (req, res) => {
    const { subjectId, questionId } = req.params;
    const allQuestions = readJSONFile(QUESTIONS_FILE) || {};
    
    if (allQuestions[subjectId]) {
        allQuestions[subjectId] = allQuestions[subjectId].filter(q => q.id != questionId);
        
        if (writeJSONFile(QUESTIONS_FILE, allQuestions)) {
            res.json({ success: true, message: 'Question deleted successfully' });
        } else {
            res.status(500).json({ error: 'Failed to delete question' });
        }
    } else {
        res.status(404).json({ error: 'Subject not found' });
    }
});

// Get all results
app.get('/api/admin/results', (req, res) => {
    const results = readJSONFile(RESULTS_FILE);
    if (results) {
        res.json(results);
    } else {
        res.status(500).json({ error: 'Failed to load results' });
    }
});

// Export surprise test results to Excel
app.get('/api/admin/export-surprise-test', async (req, res) => {
    try {
        const results = readJSONFile(RESULTS_FILE) || [];
        const subjects = readJSONFile(SUBJECTS_FILE) || [];
        
        // Filter only surprise test results
        const surpriseSubject = subjects.find(s => s.isSurpriseTest);
        if (!surpriseSubject) {
            return res.status(404).json({ error: 'Surprise test subject not found' });
        }
        
        const surpriseResults = results.filter(r => r.subjectId === surpriseSubject.id);
        
        if (surpriseResults.length === 0) {
            return res.status(404).json({ error: 'No surprise test results found' });
        }
        
        // Create Excel workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Surprise Test Results');
        
        // Add headers
        worksheet.columns = [
            { header: 'Student ID', key: 'studentId', width: 15 },
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Email', key: 'email', width: 30 },
            { header: 'Mobile', key: 'mobile', width: 15 },
            { header: 'Score', key: 'score', width: 12 },
            { header: 'Percentage', key: 'percentage', width: 12 },
            { header: 'Exam Date', key: 'examDate', width: 20 }
        ];
        
        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
        
        // Add data rows
        surpriseResults.forEach(result => {
            // Handle both old and new result formats
            const studentName = result.studentName || result.student?.name || 'N/A';
            const studentEmail = result.studentEmail || result.student?.email || 'N/A';
            const studentMobile = result.studentMobile || result.student?.mobile || 'N/A';
            const examDate = result.timestamp || result.submissionTime || new Date().toISOString();
            
            worksheet.addRow({
                studentId: result.studentId || 'N/A',
                name: studentName,
                email: studentEmail,
                mobile: studentMobile,
                score: `${result.obtainedMarks}/${result.totalMarks}`,
                percentage: `${result.percentage}%`,
                examDate: new Date(examDate).toLocaleString('en-IN', { 
                    dateStyle: 'medium', 
                    timeStyle: 'medium' 
                })
            });
        });
        
        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Surprise_Test_Results_${Date.now()}.xlsx`);
        
        // Write to response
        await workbook.xlsx.write(res);
        res.end();
        
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ error: 'Failed to export results: ' + error.message });
    }
});



// Get all students
app.get('/api/admin/students', (req, res) => {
    const students = readJSONFile(STUDENTS_FILE);
    if (students) {
        res.json(students);
    } else {
        res.status(500).json({ error: 'Failed to load students' });
    }
});

// Delete all students (must be before :studentId route)
app.delete('/api/admin/students/delete-all/confirm', (req, res) => {
    const emptyStudents = [];
    
    if (writeJSONFile(STUDENTS_FILE, emptyStudents)) {
        res.json({ 
            success: true, 
            message: 'All students deleted successfully',
            deletedCount: 0 // Will be updated by frontend
        });
    } else {
        res.status(500).json({ error: 'Failed to delete all students' });
    }
});

// Delete a specific student
app.delete('/api/admin/students/:studentId', (req, res) => {
    const { studentId } = req.params;
    
    const students = readJSONFile(STUDENTS_FILE);
    if (!students) {
        return res.status(500).json({ error: 'Failed to load students' });
    }
    
    const initialLength = students.length;
    const filteredStudents = students.filter(s => s.id !== studentId);
    
    if (filteredStudents.length === initialLength) {
        return res.status(404).json({ error: 'Student not found' });
    }
    
    if (writeJSONFile(STUDENTS_FILE, filteredStudents)) {
        res.json({ 
            success: true, 
            message: 'Student deleted successfully',
            studentId 
        });
    } else {
        res.status(500).json({ error: 'Failed to delete student' });
    }
});

// Add new subject
app.post('/api/admin/subjects', (req, res) => {
    const { name, duration, description } = req.body;
    
    if (!name || !duration) {
        return res.status(400).json({ error: 'Name and duration are required' });
    }
    
    const subjects = readJSONFile(SUBJECTS_FILE);
    if (!subjects) {
        return res.status(500).json({ error: 'Failed to load subjects' });
    }
    
    // Generate new ID
    const newId = 'subject-' + Date.now();
    
    const newSubject = {
        id: newId,
        name: name.trim(),
        duration: parseInt(duration),
        description: description ? description.trim() : ''
    };
    
    subjects.push(newSubject);
    
    if (writeJSONFile(SUBJECTS_FILE, subjects)) {
        // Also initialize empty questions array for this subject
        const allQuestions = readJSONFile(QUESTIONS_FILE) || {};
        allQuestions[newId] = [];
        writeJSONFile(QUESTIONS_FILE, allQuestions);
        
        res.json({ 
            success: true, 
            message: 'Subject added successfully',
            subject: newSubject
        });
    } else {
        res.status(500).json({ error: 'Failed to add subject' });
    }
});

// Update subject
app.put('/api/admin/subjects/:subjectId', (req, res) => {
    const { subjectId } = req.params;
    const { name, duration, description, showAnswers } = req.body;
    
    const subjects = readJSONFile(SUBJECTS_FILE);
    if (!subjects) {
        return res.status(500).json({ error: 'Failed to load subjects' });
    }
    
    const subjectIndex = subjects.findIndex(s => s.id === subjectId);
    if (subjectIndex === -1) {
        return res.status(404).json({ error: 'Subject not found' });
    }
    
    // If only showAnswers is being updated (toggle operation)
    if (showAnswers !== undefined && !name && !duration) {
        subjects[subjectIndex].showAnswers = showAnswers;
    } else {
        // Full update operation
        if (!name || !duration) {
            return res.status(400).json({ error: 'Name and duration are required' });
        }
        
        // Update subject
        subjects[subjectIndex] = {
            ...subjects[subjectIndex],
            name: name.trim(),
            duration: parseInt(duration),
            description: description ? description.trim() : '',
            showAnswers: showAnswers !== undefined ? showAnswers : subjects[subjectIndex].showAnswers
        };
    }
    
    if (writeJSONFile(SUBJECTS_FILE, subjects)) {
        res.json({ 
            success: true, 
            message: 'Subject updated successfully',
            subject: subjects[subjectIndex]
        });
    } else {
        res.status(500).json({ error: 'Failed to update subject' });
    }
});

// Delete subject
app.delete('/api/admin/subjects/:subjectId', (req, res) => {
    const { subjectId } = req.params;
    
    logToConsole('delete', `[DELETE EXAM] Request received for exam: ${subjectId}`);
    
    const subjects = readJSONFile(SUBJECTS_FILE);
    if (!subjects) {
        logToConsole('error', `[DELETE EXAM] Failed to load subjects file`);
        return res.status(500).json({ error: 'Failed to load subjects' });
    }
    
    const initialLength = subjects.length;
    const filteredSubjects = subjects.filter(s => s.id !== subjectId);
    
    if (filteredSubjects.length === initialLength) {
        logToConsole('error', `[DELETE EXAM] Exam not found: ${subjectId}`);
        return res.status(404).json({ error: 'Subject not found' });
    }
    
    const deletedSubject = subjects.find(s => s.id === subjectId);
    logToConsole('info', `[DELETE EXAM] Deleting exam: ${deletedSubject?.name || subjectId}`);
    
    // Also delete all questions for this subject
    const allQuestions = readJSONFile(QUESTIONS_FILE) || {};
    const questionsCount = allQuestions[subjectId]?.length || 0;
    delete allQuestions[subjectId];
    
    logToConsole('info', `[DELETE EXAM] Also deleting ${questionsCount} questions for this exam`);
    
    if (writeJSONFile(SUBJECTS_FILE, filteredSubjects) && writeJSONFile(QUESTIONS_FILE, allQuestions)) {
        logToConsole('success', `[DELETE EXAM] Successfully deleted exam "${deletedSubject?.name}" and ${questionsCount} questions`);
        res.json({ 
            success: true, 
            message: 'Subject and its questions deleted successfully',
            subjectId 
        });
    } else {
        logToConsole('error', `[DELETE EXAM] Failed to write files`);
        res.status(500).json({ error: 'Failed to delete subject' });
    }
});

// Export data
app.get('/api/admin/export', (req, res) => {
    const subjects = readJSONFile(SUBJECTS_FILE);
    const questions = readJSONFile(QUESTIONS_FILE);
    const students = readJSONFile(STUDENTS_FILE);
    const results = readJSONFile(RESULTS_FILE);

    const exportData = {
        subjects,
        questions,
        students,
        results,
        exportDate: new Date().toISOString()
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=kyp-exam-data.json');
    res.json(exportData);
});

// Import data
app.post('/api/admin/import', (req, res) => {
    const { subjects, questions } = req.body;
    
    if (!subjects || !questions) {
        return res.status(400).json({ error: 'Invalid data format' });
    }

    const success = writeJSONFile(SUBJECTS_FILE, subjects) && 
                   writeJSONFile(QUESTIONS_FILE, questions);

    if (success) {
        res.json({ success: true, message: 'Data imported successfully' });
    } else {
        res.status(500).json({ error: 'Failed to import data' });
    }
});

// Language translations
const languages = {
    en: {
        title: "KYP Practice Test Exam",
        subtitle: "Kushal Yuva Program - Practice Test Exam",
        organization: "Mithila Education and Welfare Society",
        selectLanguage: "Select Language",
        studentInfo: "Student Information",
        fullName: "Full Name",
        rollNumber: "Roll Number",
        selectSubject: "Select Subject",
        startExam: "Start Exam",
        timeRemaining: "Time Remaining",
        question: "Question",
        submitAnswer: "Submit Answer",
        submitExam: "Submit Exam",
        examResults: "Exam Results",
        score: "Your Score",
        correctAnswers: "Correct Answers",
        totalQuestions: "Total Questions",
        percentage: "Percentage",
        backToHome: "Back to Home",
        adminPanel: "Admin Panel",
        login: "Login",
        username: "Username",
        password: "Password",
        dashboard: "Dashboard",
        questionManagement: "Question Management",
        results: "Results",
        students: "Students"
    },
    hi: {
        title: "à¤•à¥‡à¤µà¤¾à¤ˆà¤ªà¥€ à¤…à¤­à¥à¤¯à¤¾à¤¸ à¤ªà¤°à¥€à¤•à¥à¤·à¤¾",
        subtitle: "à¤•à¥à¤¶à¤² à¤¯à¥à¤µà¤¾ à¤•à¤¾à¤°à¥à¤¯à¤•à¥à¤°à¤® - à¤…à¤­à¥à¤¯à¤¾à¤¸ à¤ªà¤°à¥€à¤•à¥à¤·à¤¾",
        organization: "à¤®à¤¿à¤¥à¤¿à¤²à¤¾ à¤¶à¤¿à¤•à¥à¤·à¤¾ à¤à¤µà¤‚ à¤•à¤²à¥à¤¯à¤¾à¤£ à¤¸à¤®à¤¿à¤¤à¤¿",
        selectLanguage: "à¤­à¤¾à¤·à¤¾ à¤šà¥à¤¨à¥‡à¤‚",
        studentInfo: "à¤›à¤¾à¤¤à¥à¤° à¤•à¥€ à¤œà¤¾à¤¨à¤•à¤¾à¤°à¥€",
        fullName: "à¤ªà¥‚à¤°à¤¾ à¤¨à¤¾à¤®",
        rollNumber: "à¤°à¥‹à¤² à¤¨à¤‚à¤¬à¤°",
        selectSubject: "à¤µà¤¿à¤·à¤¯ à¤šà¥à¤¨à¥‡à¤‚",
        startExam: "à¤ªà¤°à¥€à¤•à¥à¤·à¤¾ à¤¶à¥à¤°à¥‚ à¤•à¤°à¥‡à¤‚",
        timeRemaining: "à¤¬à¤šà¤¾ à¤¸à¤®à¤¯",
        question: "à¤ªà¥à¤°à¤¶à¥à¤¨",
        submitAnswer: "à¤‰à¤¤à¥à¤¤à¤° à¤œà¤®à¤¾ à¤•à¤°à¥‡à¤‚",
        submitExam: "à¤ªà¤°à¥€à¤•à¥à¤·à¤¾ à¤œà¤®à¤¾ à¤•à¤°à¥‡à¤‚",
        examResults: "à¤ªà¤°à¥€à¤•à¥à¤·à¤¾ à¤ªà¤°à¤¿à¤£à¤¾à¤®",
        score: "à¤†à¤ªà¤•à¤¾ à¤¸à¥à¤•à¥‹à¤°",
        correctAnswers: "à¤¸à¤¹à¥€ à¤‰à¤¤à¥à¤¤à¤°",
        totalQuestions: "à¤•à¥à¤² à¤ªà¥à¤°à¤¶à¥à¤¨",
        percentage: "à¤ªà¥à¤°à¤¤à¤¿à¤¶à¤¤",
        backToHome: "à¤¹à¥‹à¤® à¤ªà¤° à¤µà¤¾à¤ªà¤¸ à¤œà¤¾à¤à¤‚",
        adminPanel: "à¤ªà¥à¤°à¤¶à¤¾à¤¸à¤¨ à¤ªà¥ˆà¤¨à¤²",
        login: "à¤²à¥‰à¤—à¤¿à¤¨",
        username: "à¤‰à¤ªà¤¯à¥‹à¤—à¤•à¤°à¥à¤¤à¤¾ à¤¨à¤¾à¤®",
        password: "à¤ªà¤¾à¤¸à¤µà¤°à¥à¤¡",
        dashboard: "à¤¡à¥ˆà¤¶à¤¬à¥‹à¤°à¥à¤¡",
        questionManagement: "à¤ªà¥à¤°à¤¶à¥à¤¨ à¤ªà¥à¤°à¤¬à¤‚à¤§à¤¨",
        results: "à¤ªà¤°à¤¿à¤£à¤¾à¤®",
        students: "à¤›à¤¾à¤¤à¥à¤°"
    }
};

// Get language data
app.get('/api/languages', (req, res) => {
    res.json(languages);
});

// Get specific language
app.get('/api/languages/:lang', (req, res) => {
    const { lang } = req.params;
    if (languages[lang]) {
        res.json(languages[lang]);
    } else {
        res.status(404).json({ error: 'Language not found' });
    }
});

// Get server info
app.get('/api/info', (req, res) => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    
    let serverIP = 'localhost';
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                serverIP = net.address;
                break;
            }
        }
    }

    res.json({
        serverIP,
        port: PORT,
        clientURL: `http://${serverIP}:${PORT}`,
        uptime: process.uptime(),
        startTime: new Date(Date.now() - process.uptime() * 1000).toISOString()
    });
});

// API endpoint to get server logs
app.get('/api/admin/logs', (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const type = req.query.type; // filter by type
    
    let logs = [...serverLogs];
    
    // Filter by type if specified
    if (type && type !== 'all') {
        logs = logs.filter(log => log.type === type);
    }
    
    // Return last N logs (newest first)
    const recentLogs = logs.slice(-limit).reverse();
    
    res.json({
        success: true,
        count: recentLogs.length,
        total: serverLogs.length,
        logs: recentLogs
    });
});

// API endpoint to clear logs
app.delete('/api/admin/logs', (req, res) => {
    const cleared = serverLogs.length;
    serverLogs.length = 0;
    logToConsole('info', `Cleared ${cleared} log entries`);
    res.json({ success: true, message: `Cleared ${cleared} logs` });
});

// Root route - serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route for SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
initializeData();

app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    
    console.log('\nðŸŽ“ KYP Exam System Server Started!');
    console.log('==========================================');
    console.log(`ðŸ–¥ï¸  Server running on port: ${PORT}`);
    console.log(`ðŸŒ Local access: http://localhost:${PORT}`);
    
    // Show all available IP addresses
    console.log('\nðŸ“¡ Network Access URLs:');
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`   ðŸŒ http://${net.address}:${PORT}`);
            }
        }
    }
    
    console.log('\nðŸ“‹ Admin Panel: /admin');
    console.log('ðŸ”‘ Default Admin: admin / admin123');
    console.log('\nðŸ’¡ Share the Network URL with all client PCs');
    console.log('==========================================\n');
});

module.exports = app;
