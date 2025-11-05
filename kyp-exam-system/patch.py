import re

with open('C:/Users/RK/kyp-exam-system/public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add surprise test check in showResults
search = "document.getElementById('resultContainer').style.display = 'block';"
replace = """document.getElementById('resultContainer').style.display = 'block';

            // Special handling for surprise test
            if (isSurpriseTest) {
                document.getElementById('finalScore').textContent = 'Test Submitted';
                document.getElementById('finalPercentage').textContent = 'Results will be reviewed';
                document.getElementById('answerReview').innerHTML = '<div style="text-align:center;padding:40px">Test submitted successfully! Results will be shared by admin.</div>';
                return;
            }"""

if search in content:
    content = content.replace(search, replace, 1)
    with open('C:/Users/RK/kyp-exam-system/public/index.html', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched showResults function")
else:
    print("Pattern not found")
