with open('C:/Users/RK/kyp-exam-system/public/admin.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Add button after "Export to Excel" button
button_html = '''
                            <button onclick="downloadSurpriseTestResults()" class="btn" style="display: inline-flex; align-items: center; gap: 8px; background: #9b59b6; color: white;">
                                <span style="font-size: 1.2em;">🎯</span>
                                Download Surprise Test Results
                            </button>'''

search_btn = 'Export to Excel\n                            </button>'
if search_btn in content:
    content = content.replace(search_btn, 'Export to Excel\n                            </button>' + button_html, 1)

# Add JavaScript function before last </script> tag
js_function = '''
        async function downloadSurpriseTestResults() {
            try {
                const response = await fetch(API_BASE + '/admin/export-surprise-test');
                
                if (!response.ok) {
                    const error = await response.json();
                    alert('❌ ' + (error.error || 'Failed to export'));
                    return;
                }
                
                const disposition = response.headers.get('Content-Disposition');
                let filename = 'Surprise_Test_Results.xlsx';
                if (disposition && disposition.includes('filename=')) {
                    filename = disposition.split('filename=')[1].replace(/"/g, '');
                }
                
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                alert('✓ Surprise test results downloaded!');
                
            } catch (error) {
                console.error('Download error:', error);
                alert('❌ Failed: ' + error.message);
            }
        }

    </script>'''

content = content.replace('    </script>', js_function, 1)

with open('C:/Users/RK/kyp-exam-system/public/admin.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Admin panel updated with surprise test download feature")
