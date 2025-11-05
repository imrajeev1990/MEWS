with open('C:/Users/RK/kyp-exam-system/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the single delete endpoint and add delete-all after it
search_text = '''app.delete('/api/admin/questions/:subjectId/:questionId', (req, res) => {
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
});'''

new_endpoint = '''
// Delete all questions for a subject
app.delete('/api/admin/questions/:subjectId/delete-all', (req, res) => {
    const { subjectId } = req.params;
    const allQuestions = readJSONFile(QUESTIONS_FILE) || {};

    if (!allQuestions[subjectId]) {
        return res.status(404).json({ error: 'Subject not found' });
    }

    const deletedCount = allQuestions[subjectId].length;

    if (deletedCount === 0) {
        return res.json({ success: true, message: 'No questions to delete', deletedCount: 0 });
    }

    allQuestions[subjectId] = [];

    if (writeJSONFile(QUESTIONS_FILE, allQuestions)) {
        res.json({
            success: true,
            message: `Successfully deleted all ${ deletedCount} questions`,
            deletedCount: deletedCount
        });
    } else {
        res.status(500).json({ error: 'Failed to delete questions' });
    }
});'''

if search_text in content:
    content = content.replace(search_text, search_text + new_endpoint, 1)
    print("Endpoint found and added")
else:
    print("Search pattern not found")

with open('C:/Users/RK/kyp-exam-system/server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Delete-all endpoint added successfully")
