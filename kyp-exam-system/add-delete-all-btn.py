with open('C:/Users/RK/kyp-exam-system/public/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the Manage Questions section and add Delete All button
search_pattern = '''<div class="form-group">
                            <select id="filterSubject" onchange="loadQuestions()">
                                <option value="">All Subjects</option>
                            </select>
                        </div>'''

replace_with = '''<div class="form-group" style="display: flex; justify-content: space-between; align-items: center; gap: 15px; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 200px;">
                                <label style="font-weight: bold; margin-bottom: 8px; display: block;">Filter by Subject:</label>
                                <select id="filterSubject" onchange="loadQuestions()" style="width: 100%; padding: 10px; border: 1px solid #ced4da; border-radius: 5px;">
                                    <option value="">All Subjects</option>
                                </select>
                            </div>
                            <div>
                                <button onclick="deleteAllQuestions()" class="btn" style="background: #e74c3c; color: white; display: inline-flex; align-items: center; gap: 8px; margin-top: 28px;">
                                    <span style="font-size: 1.2em;">🗑️</span>
                                    Delete All Questions
                                </button>
                            </div>
                        </div>'''

if search_pattern in content:
    content = content.replace(search_pattern, replace_with, 1)
    print("Button added successfully")
else:
    print("Pattern not found - trying alternative")

with open('C:/Users/RK/kyp-exam-system/public/admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Delete All button added to Manage Questions section")
