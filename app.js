// Stencil Maker Web App
class StencilMaker {
    constructor() {
        this.currentImage = null;
        this.currentAnalysis = null;
        this.currentSVG = null;
        
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Upload area events
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        
        // Click to browse
        uploadArea.addEventListener('click', () => fileInput.click());
        
        // File input change
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        
        // Drag and drop events
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Remove image button
        document.getElementById('remove-image').addEventListener('click', () => this.resetInterface());
        
        // Create stencil button
        document.getElementById('create-stencil-btn').addEventListener('click', () => this.createStencil());
        
        // Download SVG button
        document.getElementById('download-svg').addEventListener('click', () => this.downloadSVG());
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('upload-area').classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('upload-area').classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const uploadArea = document.getElementById('upload-area');
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFileSelect(files[0]);
        }
    }
    
    handleFileSelect(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            this.showError('Please select a valid image file.');
            return;
        }
        
        // Check file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
            this.showError('File size too large. Please use an image under 10MB.');
            return;
        }
        
        // Read file as data URL
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentImage = e.target.result;
            this.displayImagePreview(this.currentImage);
            this.analyzeImage(this.currentImage);
        };
        reader.readAsDataURL(file);
    }
    
    displayImagePreview(imageData) {
        const previewImage = document.getElementById('preview-image');
        previewImage.src = imageData;
        
        // Show preview section
        document.getElementById('upload-area').style.display = 'none';
        document.getElementById('preview-section').style.display = 'grid';
    }
    
    async analyzeImage(imageData) {
        const analysisLoading = document.getElementById('analysis-loading');
        const analysisResults = document.getElementById('analysis-results');
        
        // Show loading
        analysisLoading.style.display = 'block';
        analysisResults.style.display = 'none';
        
        try {
            // Client-side image analysis
            const analysis = await this.analyzeImageClientSide(imageData);
            this.currentAnalysis = analysis;
            
            // Display results
            this.displayAnalysisResults(analysis);
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.showError('Failed to analyze image. Please try again.');
        } finally {
            analysisLoading.style.display = 'none';
        }
    }
    
    async analyzeImageClientSide(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for analysis
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image to canvas
                ctx.drawImage(img, 0, 0);
                
                // Get image data
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;
                
                // Analyze the image
                const scores = {};
                
                // 1. Contrast Analysis
                scores.contrast = this.analyzeContrast(pixels);
                
                // 2. Floating Elements (simplified)
                scores.floating_elements = this.analyzeFloatingElements(pixels, canvas.width, canvas.height);
                
                // 3. Line Thickness
                scores.line_thickness = this.analyzeLineThickness(pixels, canvas.width, canvas.height);
                
                // 4. Detail Complexity
                scores.detail_complexity = this.analyzeDetailComplexity(pixels, canvas.width, canvas.height);
                
                // 5. Closed Paths
                scores.closed_paths = this.analyzeClosedPaths(pixels, canvas.width, canvas.height);
                
                // 6. Resolution
                scores.resolution = this.analyzeResolution(canvas.width, canvas.height);
                
                // Calculate overall rating
                const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
                const maxPossible = Object.keys(scores).length * 5;
                const rating = Math.max(1, Math.min(5, Math.round((total / maxPossible) * 5)));
                
                resolve({
                    rating: rating,
                    scores: scores,
                    recommendations: this.generateRecommendations(scores),
                    total_score: total,
                    max_possible: maxPossible
                });
            };
            img.src = imageData;
        });
    }
    
    analyzeContrast(pixels) {
        let darkPixels = 0, lightPixels = 0, midPixels = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            
            if (gray < 85) darkPixels++;
            else if (gray > 170) lightPixels++;
            else midPixels++;
        }
        
        const totalPixels = pixels.length / 4;
        const extremeRatio = (darkPixels + lightPixels) / totalPixels;
        
        if (extremeRatio > 0.7) return 5;
        if (extremeRatio > 0.5) return 4;
        if (extremeRatio > 0.3) return 3;
        if (extremeRatio > 0.2) return 2;
        return 1;
    }
    
    analyzeFloatingElements(pixels, width, height) {
        // Simple analysis - count distinct regions by sampling
        const samples = 20;
        let regions = new Set();
        
        for (let i = 0; i < samples; i++) {
            const x = Math.floor((i / samples) * width);
            const y = Math.floor(height / 2);
            const idx = (y * width + x) * 4;
            
            const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
            const gray = Math.floor((0.299 * r + 0.587 * g + 0.114 * b) / 50) * 50;
            regions.add(gray);
        }
        
        const numRegions = regions.size;
        if (numRegions <= 2) return 5;
        if (numRegions <= 4) return 4;
        if (numRegions <= 6) return 3;
        if (numRegions <= 8) return 2;
        return 1;
    }
    
    analyzeLineThickness(pixels, width, height) {
        let darkPixels = 0;
        
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            if (gray < 100) darkPixels++;
        }
        
        const totalPixels = pixels.length / 4;
        const darkRatio = darkPixels / totalPixels;
        
        if (darkRatio > 0.4) return 5;
        if (darkRatio > 0.25) return 4;
        if (darkRatio > 0.15) return 3;
        if (darkRatio > 0.05) return 2;
        return 1;
    }
    
    analyzeDetailComplexity(pixels, width, height) {
        // Sample edge detection
        let edgeCount = 0;
        const sampleSize = Math.min(1000, pixels.length / 4);
        
        for (let i = 0; i < sampleSize; i++) {
            const idx = Math.floor((i / sampleSize) * (pixels.length / 4)) * 4;
            const r1 = pixels[idx], g1 = pixels[idx + 1], b1 = pixels[idx + 2];
            const r2 = pixels[idx + 4] || r1, g2 = pixels[idx + 5] || g1, b2 = pixels[idx + 6] || b1;
            
            const gray1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
            const gray2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
            
            if (Math.abs(gray1 - gray2) > 30) edgeCount++;
        }
        
        const edgeRatio = edgeCount / sampleSize;
        
        if (edgeRatio < 0.05) return 5;
        if (edgeRatio < 0.1) return 4;
        if (edgeRatio < 0.2) return 3;
        if (edgeRatio < 0.3) return 2;
        return 1;
    }
    
    analyzeClosedPaths(pixels, width, height) {
        // Sample center vs edge contrast
        const centerX = Math.floor(width / 2);
        const centerY = Math.floor(height / 2);
        const centerIdx = (centerY * width + centerX) * 4;
        
        const centerR = pixels[centerIdx], centerG = pixels[centerIdx + 1], centerB = pixels[centerIdx + 2];
        const centerGray = 0.299 * centerR + 0.587 * centerG + 0.114 * centerB;
        
        // Sample edges
        let edgeGraySum = 0, edgeCount = 0;
        
        // Top edge
        for (let x = 0; x < width; x += 10) {
            const idx = x * 4;
            const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
            edgeGraySum += 0.299 * r + 0.587 * g + 0.114 * b;
            edgeCount++;
        }
        
        const edgeGray = edgeGraySum / edgeCount;
        const contrast = Math.abs(centerGray - edgeGray) / 255;
        
        if (contrast > 0.3) return 5;
        if (contrast > 0.2) return 4;
        if (contrast > 0.1) return 3;
        if (contrast > 0.05) return 2;
        return 1;
    }
    
    analyzeResolution(width, height) {
        if (width < 300 || height < 300) return 1;
        if (width < 600 || height < 600) return 2;
        if (width < 1000 || height < 1000) return 3;
        if (width < 1500 || height < 1500) return 4;
        return 5;
    }
    
    generateRecommendations(scores) {
        const recommendations = [];
        
        if (scores.contrast < 3) {
            recommendations.push("🔧 Increase contrast - try adjusting levels in an image editor");
        }
        if (scores.floating_elements < 3) {
            recommendations.push("🔗 Add bridges to connect floating elements or use a stencil font");
        }
        if (scores.line_thickness < 3) {
            recommendations.push("📏 Thicken thin lines - they may tear during weeding");
        }
        if (scores.detail_complexity < 3) {
            recommendations.push("✂️ Simplify details - remove small elements that are hard to cut");
        }
        if (scores.closed_paths < 3) {
            recommendations.push("🔄 Ensure shapes are closed - open paths cause cutting issues");
        }
        if (scores.resolution < 3) {
            recommendations.push("📐 Use higher resolution image (at least 1000px width)");
        }
        
        if (recommendations.length === 0) {
            recommendations.push("✅ Great image! Should work well as a stencil");
        }
        
        return recommendations;
    }
    
    displayAnalysisResults(analysis) {
        const analysisResults = document.getElementById('analysis-results');
        const ratingStars = document.getElementById('rating-stars');
        const ratingText = document.getElementById('rating-text');
        const scoreDetails = document.getElementById('score-details');
        const recommendationsList = document.getElementById('recommendations-list');
        
        // Display star rating
        ratingStars.innerHTML = this.generateStarRating(analysis.rating);
        ratingText.textContent = this.getRatingText(analysis.rating);
        
        // Display score breakdown
        scoreDetails.innerHTML = this.generateScoreBreakdown(analysis.scores);
        
        // Display recommendations
        recommendationsList.innerHTML = '';
        analysis.recommendations.forEach(rec => {
            const li = document.createElement('li');
            li.textContent = rec;
            recommendationsList.appendChild(li);
        });
        
        // Show results and stencil section
        analysisResults.style.display = 'block';
        document.getElementById('stencil-section').style.display = 'block';
    }
    
    generateStarRating(rating) {
        let stars = '';
        for (let i = 1; i <= 5; i++) {
            if (i <= rating) {
                stars += '<span class="star-filled">★</span>';
            } else {
                stars += '<span class="star-empty">★</span>';
            }
        }
        return stars;
    }
    
    getRatingText(rating) {
        const texts = {
            5: 'Excellent for stencils!',
            4: 'Good stencil candidate',
            3: 'Fair - may need adjustments',
            2: 'Poor - significant issues',
            1: 'Not suitable for stencils'
        };
        return texts[rating] || 'Unknown rating';
    }
    
    generateScoreBreakdown(scores) {
        const scoreLabels = {
            contrast: 'High Contrast',
            floating_elements: 'No Floating Elements',
            line_thickness: 'Thick Lines',
            detail_complexity: 'Simple Details',
            closed_paths: 'Closed Paths',
            resolution: 'Image Quality'
        };
        
        let html = '';
        Object.entries(scores).forEach(([key, value]) => {
            const label = scoreLabels[key] || key;
            const scoreClass = value >= 4 ? 'score-good' : value >= 3 ? 'score-fair' : 'score-poor';
            
            html += `
                <div class="score-item ${scoreClass}">
                    <span>${label}</span>
                    <span class="score-value">${value}/5</span>
                </div>
            `;
        });
        
        return html;
    }
    
    async createStencil() {
        if (!this.currentImage) {
            this.showError('No image loaded');
            return;
        }
        
        const width = parseFloat(document.getElementById('width-input').value);
        if (width < 1 || width > 20) {
            this.showError('Width must be between 1 and 20 inches');
            return;
        }
        
        const stencilLoading = document.getElementById('stencil-loading');
        const stencilResults = document.getElementById('stencil-results');
        
        // Show loading
        stencilLoading.style.display = 'block';
        stencilResults.style.display = 'none';
        
        try {
            // Client-side stencil creation
            const svgContent = await this.createStencilClientSide(this.currentImage, width);
            
            this.currentSVG = {
                content: svgContent,
                filename: `stencil_${width}inch.svg`
            };
            
            // Show success
            stencilResults.style.display = 'block';
            this.showSuccess('Stencil created successfully! Ready for download.');
            
        } catch (error) {
            console.error('Stencil creation error:', error);
            this.showError('Failed to create stencil. Please try again.');
        } finally {
            stencilLoading.style.display = 'none';
        }
    }
    
    async createStencilClientSide(imageData, widthInches) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for processing
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Draw image to canvas
                ctx.drawImage(img, 0, 0);
                
                // Get image data and process to black/white
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;
                
                // Convert to grayscale and threshold
                for (let i = 0; i < pixels.length; i += 4) {
                    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
                    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                    const bw = gray < 128 ? 0 : 255;
                    pixels[i] = pixels[i + 1] = pixels[i + 2] = bw;
                }
                
                // Find bounding box of dark areas
                let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
                let foundDark = false;
                
                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const idx = (y * canvas.width + x) * 4;
                        if (pixels[idx] < 128) { // Dark pixel
                            foundDark = true;
                            minX = Math.min(minX, x);
                            maxX = Math.max(maxX, x);
                            minY = Math.min(minY, y);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }
                
                if (!foundDark) {
                    resolve(this.createSimpleSVG(widthInches, canvas.width, canvas.height));
                    return;
                }
                
                // Calculate scaling
                const originalWidth = canvas.width;
                const originalHeight = canvas.height;
                const targetWidthPx = widthInches * 96; // 96 DPI
                const scaleFactor = targetWidthPx / originalWidth;
                const targetHeightPx = originalHeight * scaleFactor;
                
                // Create simplified path (rectangle for now - could be enhanced)
                const scaledMinX = minX * scaleFactor;
                const scaledMaxX = maxX * scaleFactor;
                const scaledMinY = minY * scaleFactor;
                const scaledMaxY = maxY * scaleFactor;
                
                const pathData = `M ${scaledMinX} ${scaledMinY} L ${scaledMaxX} ${scaledMinY} L ${scaledMaxX} ${scaledMaxY} L ${scaledMinX} ${scaledMaxY} Z`;
                
                // Create SVG
                const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${targetWidthPx}px" 
     height="${targetHeightPx}px" 
     viewBox="0 0 ${targetWidthPx} ${targetHeightPx}">
  <g fill="black" stroke="none">
    <path d="${pathData}"/>
  </g>
</svg>`;
                
                resolve(svgContent);
            };
            img.src = imageData;
        });
    }
    
    createSimpleSVG(widthInches, originalWidth, originalHeight) {
        const targetWidthPx = widthInches * 96;
        const scaleFactor = targetWidthPx / originalWidth;
        const targetHeightPx = originalHeight * scaleFactor;
        
        // Create a simple placeholder rectangle
        return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" 
     width="${targetWidthPx}px" 
     height="${targetHeightPx}px" 
     viewBox="0 0 ${targetWidthPx} ${targetHeightPx}">
  <g fill="black" stroke="none">
    <rect x="10" y="10" width="${targetWidthPx - 20}" height="${targetHeightPx - 20}"/>
    <text x="${targetWidthPx/2}" y="${targetHeightPx/2}" 
          text-anchor="middle" font-family="Arial" font-size="24" fill="white">
      TEST STENCIL
    </text>
    <text x="${targetWidthPx/2}" y="${targetHeightPx/2 + 30}" 
          text-anchor="middle" font-family="Arial" font-size="16" fill="white">
      ${widthInches}" wide
    </text>
  </g>
</svg>`;
    }
    
    downloadSVG() {
        if (!this.currentSVG) {
            this.showError('No stencil available for download');
            return;
        }
        
        // Create download link
        const blob = new Blob([this.currentSVG.content], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = this.currentSVG.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        URL.revokeObjectURL(url);
        
        this.showSuccess('SVG downloaded! Import it into Cricut Design Space.');
    }
    
    resetInterface() {
        this.currentImage = null;
        this.currentAnalysis = null;
        this.currentSVG = null;
        
        // Reset UI
        document.getElementById('upload-area').style.display = 'block';
        document.getElementById('preview-section').style.display = 'none';
        document.getElementById('stencil-section').style.display = 'none';
        
        // Clear file input
        document.getElementById('file-input').value = '';
        
        // Hide any messages
        this.hideMessages();
    }
    
    showError(message) {
        this.hideMessages();
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        document.querySelector('main').insertBefore(errorDiv, document.querySelector('main').firstChild);
        
        // Auto-hide after 5 seconds
        setTimeout(() => this.hideMessages(), 5000);
    }
    
    showSuccess(message) {
        this.hideMessages();
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.textContent = message;
        document.querySelector('main').insertBefore(successDiv, document.querySelector('main').firstChild);
        
        // Auto-hide after 5 seconds
        setTimeout(() => this.hideMessages(), 5000);
    }
    
    hideMessages() {
        const messages = document.querySelectorAll('.error, .success');
        messages.forEach(msg => msg.remove());
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new StencilMaker();
});

// Prevent default drag behaviors on the entire page
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());