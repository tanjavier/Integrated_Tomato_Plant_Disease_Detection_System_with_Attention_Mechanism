document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('upload-form');
    const resultContainer = document.getElementById('result-container');
    const fileInput = document.getElementById('file-upload');
    const dropZone = document.getElementById('drop-zone');
    const imagePreview = document.getElementById('image-preview');
    const previewImage = document.getElementById('preview-image');
    const loadingIndicator = document.getElementById('loading');
    const errorContainer = document.getElementById('error-container');
    let chart = null;

    // Make drop zone clickable
    dropZone.addEventListener('click', function() {
        fileInput.click();
    });

    // Drag and drop functionality
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('highlight');
    }

    function unhighlight(e) {
        dropZone.classList.remove('highlight');
    }

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        fileInput.files = files;
        handleFiles(files);
    }

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        const file = files[0];
        if (file) {
            // Check file type
            if (!file.type.startsWith('image/jpeg')) {
                showError('Only JPEG images are allowed');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(e) {
                previewImage.src = e.target.result;
                imagePreview.style.display = 'block';
            }
            reader.readAsDataURL(file);
        }
    }

    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            
            // Show loading indicator
            loadingIndicator.style.display = 'block';
            resultContainer.style.display = 'none';
            errorContainer.style.display = 'none';
            
            fetch('/detect', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                // Hide loading indicator
                loadingIndicator.style.display = 'none';
                if (data.error) {
                    showError(data.error);
                } else {
                    displayResults(data);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                // Hide loading indicator in case of error
                loadingIndicator.style.display = 'none';
                showError('An error occurred while processing the image');
            });
        });
    }

    function showError(message) {
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        resultContainer.style.display = 'none';
    }
    
    function displayResults(data) {
        resultContainer.style.display = 'block';
        errorContainer.style.display = 'none';
        
        document.getElementById('original-image').src = 'data:image/jpeg;base64,' + data.original_image;
        document.getElementById('gradcam-image').src = 'data:image/jpeg;base64,' + data.gradcam_image;
        
        document.getElementById('detected-disease').textContent = data.class;
        document.getElementById('confidence').textContent = (data.confidence * 100).toFixed(2) + '%';
        
        updateChart(data.all_probabilities);
        updateDiseaseInfo(data.class);
    }
    
    function updateChart(probabilities) {
        const ctx = document.getElementById('disease-chart').getContext('2d');
        
        if (chart) {
            chart.destroy();
        }
        
        chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['Bacterial Spot', 'Early Blight', 'Late Blight', 'Leaf Mold', 'Septoria Leaf Spot', 
                         'Spider Mites', 'Target Spot', 'Yellow Leaf Curl Virus', 'Mosaic Virus', 'Healthy'],
                datasets: [{
                    data: probabilities,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                        '#FF9F40', '#33CC99', '#FF66B2', '#99CCFF', '#FFCC99'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 10
                            }
                        }
                    },
                    title: {
                        display: true,
                        text: 'Disease Probability Distribution',
                        font: {
                            size: 14
                        }
                    }
                }
            }
        });
    }
    
    function updateDiseaseInfo(disease) {
        const diseaseInfo = getDiseaseInfo(disease);
        document.getElementById('disease-info').innerHTML = `
            <h4>Symptoms:</h4>
            <p>${diseaseInfo.symptoms}</p>
            <h4>Causes:</h4>
            <p>${diseaseInfo.causes}</p>
            <h4>Preventive Measures:</h4>
            <p>${diseaseInfo.prevention}</p>
        `;
    }
    
    function getDiseaseInfo(disease) {
        const info = {
            'Bacterial Spot': {
                symptoms: 'Small, dark, water-soaked, circular spots on leaves, stems, and fruits.',
                causes: 'Caused by Xanthomonas bacteria, spread by water splashes and contaminated seeds.',
                prevention: 'Use disease-free seeds, practice crop rotation, and avoid overhead irrigation.'
            },
            'Early Blight': {
                symptoms: 'Dark brown spots with concentric rings on lower leaves, which may turn yellow and drop.',
                causes: 'Caused by the fungus Alternaria solani, favored by warm and humid conditions.',
                prevention: 'Remove infected plant debris, improve air circulation, and use fungicides if necessary.'
            },
            'Late Blight': {
                symptoms: 'Water-soaked spots on leaves, rapidly enlarging and turning brown with fuzzy white growth.',
                causes: 'Caused by the oomycete Phytophthora infestans, thrives in cool and moist conditions.',
                prevention: 'Plant resistant varieties, improve drainage, and apply fungicides preventively.'
            },
            'Leaf Mold': {
                symptoms: 'Pale green to yellow spots on upper leaf surfaces, with olive green to gray fuzzy growth underneath.',
                causes: 'Caused by the fungus Passalora fulva, favored by high humidity and moderate temperatures.',
                prevention: 'Improve air circulation, reduce humidity, and remove infected leaves.'
            },
            'Septoria Leaf Spot': {
                symptoms: 'Small, circular spots with dark borders and light centers, often with tiny black fruiting bodies.',
                causes: 'Caused by the fungus Septoria lycopersici, spreads through water splashes and contaminated tools.',
                prevention: 'Practice crop rotation, remove infected plant debris, and use fungicides if needed.'
            },
            'Spider Mites': {
                symptoms: 'Tiny yellow or brown spots on leaves, fine webbing on undersides of leaves, and stunted growth.',
                causes: 'Caused by various species of spider mites, thriving in hot and dry conditions.',
                prevention: 'Increase humidity, use predatory mites, and apply horticultural oils or insecticidal soaps.'
            },
            'Target Spot': {
                symptoms: 'Brown, circular lesions with concentric rings on leaves, stems, and fruits.',
                causes: 'Caused by the fungus Corynespora cassiicola, favored by warm and humid conditions.',
                prevention: 'Improve air circulation, avoid overhead watering, and apply fungicides if necessary.'
            },
            'Yellow Leaf Curl Virus': {
                symptoms: 'Yellowing and upward curling of leaves, stunted growth, and reduced fruit production.',
                causes: 'Caused by a complex of viruses, transmitted by whiteflies.',
                prevention: 'Use resistant varieties, control whitefly populations, and remove infected plants.'
            },
            'Mosaic Virus': {
                symptoms: 'Mottled light and dark green patches on leaves, distorted leaf growth, and stunted plants.',
                causes: 'Caused by various viruses, often spread by aphids or contaminated tools.',
                prevention: 'Use virus-free seeds, control aphid populations, and practice good sanitation.'
            },
            'Healthy': {
                symptoms: 'No visible symptoms of disease.',
                causes: 'N/A',
                prevention: 'Maintain good cultural practices, including proper watering, fertilization, and pest management.'
            }
        };
        
        return info[disease] || {
            symptoms: 'Information not available.',
            causes: 'Information not available.',
            prevention: 'Information not available.'
        };
    }
});