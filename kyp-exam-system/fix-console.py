with open('C:/Users/RK/kyp-exam-system/server.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and fix the problematic line around 1372
for i in range(len(lines)):
    if 'console.log(`' in lines[i] and i > 1360 and i < 1380:
        if 'Local access' not in lines[i] and 'KYP Exam' not in lines[i] and 'Server running' not in lines[i]:
            # This is the problematic line
            lines[i] = "    console.log('🌐 Local access: http://localhost:'+PORT);\n"
            print(f"Fixed line {i+1}")
            break

with open('C:/Users/RK/kyp-exam-system/server.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Server.js fixed")
