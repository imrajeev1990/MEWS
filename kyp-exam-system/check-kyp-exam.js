const fs = require('fs');
const path = require('path');

// Read questions.json
const questionsFile = path.join(__dirname, 'data', 'questions.json');
const questions = JSON.parse(fs.readFileSync(questionsFile, 'utf8'));

console.log('Current subjects in questions.json:');
console.log(Object.keys(questions));
console.log('\n');

// Check for kyp-november-test
if (questions['kyp-november-test']) {
    console.log('✓ kyp-november-test exists!');
    console.log(`  Questions count: ${questions['kyp-november-test'].length}`);
    
    if (questions['kyp-november-test'].length > 0) {
        console.log('\n  First question:');
        console.log(JSON.stringify(questions['kyp-november-test'][0], null, 2));
    }
} else {
    console.log('✗ kyp-november-test NOT found in questions.json');
    console.log('\nAdding empty array for kyp-november-test...');
    
    questions['kyp-november-test'] = [];
    
    fs.writeFileSync(questionsFile, JSON.stringify(questions, null, 2), 'utf8');
    console.log('✓ Added kyp-november-test to questions.json');
}

// Read subjects.json
const subjectsFile = path.join(__dirname, 'data', 'subjects.json');
const subjects = JSON.parse(fs.readFileSync(subjectsFile, 'utf8'));

console.log('\n\nSubjects in subjects.json:');
subjects.forEach(s => {
    console.log(`  - ${s.id}: ${s.name}`);
});

const kypSubject = subjects.find(s => s.id === 'kyp-november-test');
if (kypSubject) {
    console.log('\n✓ kyp-november-test found in subjects.json');
} else {
    console.log('\n✗ kyp-november-test NOT in subjects.json (should be added)');
}
