with open('C:/Users/RK/kyp-exam-system/public/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add the deleteAllQuestions function after deleteQuestion function
new_function = '''
        async function deleteAllQuestions() {
            const subjectId = document.getElementById('filterSubject').value;
            
            if (!subjectId) {
                alert('⚠️ Please select a subject first!');
                return;
            }
            
            // Get subject name for confirmation
            const subject = subjects.find(s => s.id === subjectId);
            const subjectName = subject ? subject.name : subjectId;
            
            // Count questions for this subject
            const questionsCount = allQuestions[subjectId] ? allQuestions[subjectId].length : 0;
            
            if (questionsCount === 0) {
                alert('ℹ️ No questions found for this subject!');
                return;
            }
            
            // Double confirmation
            const firstConfirm = confirm(`⚠️ WARNING: You are about to delete ALL ${questionsCount} questions from "${subjectName}"!\n\nThis action CANNOT be undone!\n\nAre you sure?`);
            
            if (!firstConfirm) return;
            
            const secondConfirm = confirm(`🚨 FINAL CONFIRMATION:\n\nDelete ${questionsCount} questions from "${subjectName}"?\n\nType YES in your mind and click OK to proceed.`);
            
            if (!secondConfirm) return;
            
            try {
                // Call API to delete all questions for this subject
                const response = await apiCall(`/admin/questions/${subjectId}/delete-all`, { 
                    method: 'DELETE' 
                });
                
                alert(`✅ Successfully deleted ${questionsCount} questions from "${subjectName}"!`);
                loadQuestions();
                
            } catch (error) {
                alert('❌ Failed to delete questions: ' + error.message);
                console.error('Delete all error:', error);
            }
        }

        // Results Management'''

search_text = "        // Results Management"
if search_text in content:
    content = content.replace(search_text, new_function, 1)
    
with open('C:/Users/RK/kyp-exam-system/public/admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("deleteAllQuestions function added successfully")
