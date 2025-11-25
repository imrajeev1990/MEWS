import json

# Read questions file
with open('data/questions.json', 'r', encoding='utf-8-sig') as f:
    questions = json.load(f)

# Clear kyp-november-test questions
if 'kyp-november-test' in questions:
    count = len(questions['kyp-november-test'])
    questions['kyp-november-test'] = []
    print(f"Cleared {count} questions from kyp-november-test")
else:
    print("kyp-november-test not found, creating empty array")
    questions['kyp-november-test'] = []

# Write back
with open('data/questions.json', 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)
    
print("✅ Questions cleared successfully!")
