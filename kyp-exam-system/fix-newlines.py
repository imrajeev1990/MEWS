with open('C:/Users/RK/kyp-exam-system/public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix literal \r\n in code
content = content.replace('`r`n', '\n')

# Ensure proper line breaks are in place
content = content.replace('let currentSubject = null;\n        let isSurpriseTest = false;', 
                          'let currentSubject = null;\n        let isSurpriseTest = false;')

content = content.replace('currentSubject = subjects.find(s => s.id === subjectId);\n                isSurpriseTest = currentSubject?.isSurpriseTest || false;',
                          'currentSubject = subjects.find(s => s.id === subjectId);\n                isSurpriseTest = currentSubject?.isSurpriseTest || false;')

with open('C:/Users/RK/kyp-exam-system/public/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed all literal newline characters")
