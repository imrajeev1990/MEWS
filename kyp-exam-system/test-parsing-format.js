// Test the parsing with the sample data from the screenshot
const text = `Q1: 1. COMPUTER क्या है? 2. कंप्यूटर का FULL FORM क्या होता है? 3. एमएस वर्ड क्या ... (4 options)

Q2: 5. BS-CIT का फुल फॉर्म क्या है? 6. MS WORD के लेआउट टैब में कितने ग्रुप होते हैं? 7. कंप्यूटर को त... (4 options)

Q3: 8. MS EXCEL में शेर और राइट एक साथ उपयोग करने के लिए कौन सी शॉर्टकट की होती है? 11. MS PAINT की... (4 options)

Q4: 14. INPUT DEVICE क्या है? 15. OUTPUT DEVICE के कौन सी उदाहरण क्या है? 16. KYP COU... (4 options)

Q5: 18. LAPTOP में कितने बटन होते हैं? 19. COMPUTER के जनक किसे कहा जाता है? 20. BSDM का FULL FORM क्या ... (4 options)

Q6: 22. तभी OPEN डॉक्युमेंट को MINIMIZE करने के लिए कौन सा शॉर्टकट उपयोग किया जाता है? 23. CPU के अंदर R... (4 options)

Q7: 26. कंप्यूटर साक्षरता दिवस कब मनाया जाता है? 27. आधुनिक कंप्यूटर की खोज कब हुई? 28. 1 MB कितने KB के... (4 options)`;

// This is the format we need to handle
console.log("Sample text to parse:");
console.log(text);
console.log("\n");

// Expected behavior:
// - Each Q block should be split
// - Within each Q block, numbered questions (1., 2., 3., etc.) should be extracted
// - Each question should have its text and 4 options
console.log("Expected output:");
console.log("- 7 Q blocks (Q1 to Q7)");
console.log("- Each Q block contains multiple numbered questions");
console.log("- Each question should have 4 options");
