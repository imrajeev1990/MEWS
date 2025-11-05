with open('C:/Users/RK/kyp-exam-system/server.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken section
old_section = '''    console.log(`ðŸŒ

    // Show all available IP addresses
    console.log('\\nðŸ"¡ Network Access URLs:');
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
    console.log('🌐 Local access: http://localhost:'+PORT);
            }
        }
    }'''

new_section = '''    console.log('🌐 Local access: http://localhost:'+PORT);

    // Show all available IP addresses
    console.log('\\nðŸ"¡ Network Access URLs:');
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`   http://${net.address}:${PORT}`);
            }
        }
    }'''

content = content.replace(old_section, new_section)

with open('C:/Users/RK/kyp-exam-system/server.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed app.listen section")
