class ImageAnnotationTool {
    constructor() {
        this.canvas = document.getElementById('annotation-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.images = [];
        this.currentImageIndex = 0;
        
        // Состояние приложения
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        
        // Текущая аннотация
        this.currentAnnotation = null;
        
        // Для хранения изображения
        this.currentImage = null;
        this.imageWidth = 0;
        this.imageHeight = 0;
        
        // Отображение (размеры на экране)
        this.displayWidth = 0;
        this.displayHeight = 0;
        this.displayRatio = 1;
        
        // Настройки
        this.tool = 'rectangle';
        this.strokeColor = '#ff0000';
        this.fillColor = 'rgba(0, 255, 0, 0.3)';
        
        // Масштабирование
        this.scale = 1;
        
        this.initializeElements();
        this.setupEventListeners();
        
        // Отладочная информация
        this.debugMode = true;
    }
    
    initializeElements() {
        this.elements = {
            singleUpload: document.getElementById('single-upload'),
            multipleUpload: document.getElementById('multiple-upload'),
            singleImageRadio: document.getElementById('single-image'),
            multipleImagesRadio: document.getElementById('multiple-images'),
            toolType: document.getElementById('tool-type'),
            annotationColor: document.getElementById('annotation-color'),
            bgColor: document.getElementById('bg-color'),
            zoomIn: document.getElementById('zoom-in'),
            zoomOut: document.getElementById('zoom-out'),
            zoomReset: document.getElementById('zoom-reset'),
            zoomLevel: document.getElementById('zoom-level'),
            clearAnnotation: document.getElementById('clear-annotation'),
            nextImage: document.getElementById('next-image'),
            currentFileName: document.getElementById('current-file-name'),
            annotationX: document.getElementById('annotation-x'),
            annotationY: document.getElementById('annotation-y'),
            annotationWidth: document.getElementById('annotation-width'),
            annotationHeight: document.getElementById('annotation-height'),
            processedCount: document.getElementById('processed-count'),
            totalCount: document.getElementById('total-count'),
            progressBar: document.getElementById('progress-bar'),
            progressInfo: document.querySelector('.progress-info'),
            canvasContainer: document.querySelector('.canvas-container')
        };
        
        // Исправляем цвет
        this.elements.bgColor.value = '#00FF00';
        this.fillColor = 'rgba(0, 255, 0, 0.3)';
    }
    
    setupEventListeners() {
        // Загрузка изображений
        this.elements.singleUpload.addEventListener('change', (e) => this.loadSingleImage(e));
        this.elements.multipleUpload.addEventListener('change', (e) => this.loadMultipleImages(e));
        
        // Переключение режимов
        this.elements.singleImageRadio.addEventListener('change', () => {
            this.elements.singleUpload.style.display = 'block';
            this.elements.multipleUpload.style.display = 'none';
            this.elements.nextImage.style.display = 'none';
            if (this.elements.progressInfo) this.elements.progressInfo.style.display = 'none';
        });
        
        this.elements.multipleImagesRadio.addEventListener('change', () => {
            this.elements.singleUpload.style.display = 'none';
            this.elements.multipleUpload.style.display = 'block';
            this.elements.nextImage.style.display = 'block';
        });
        
        // Инструменты
        this.elements.toolType.addEventListener('change', (e) => this.tool = e.target.value);
        this.elements.annotationColor.addEventListener('input', (e) => this.strokeColor = e.target.value);
        this.elements.bgColor.addEventListener('input', (e) => {
            this.fillColor = this.hexToRgba(e.target.value, 0.3);
        });
        
        // Масштаб
        this.elements.zoomIn.addEventListener('click', () => this.zoom(0.1));
        this.elements.zoomOut.addEventListener('click', () => this.zoom(-0.1));
        this.elements.zoomReset.addEventListener('click', () => this.resetZoom());
        
        // Управление
        this.elements.clearAnnotation.addEventListener('click', () => this.clearAnnotation());
        this.elements.nextImage.addEventListener('click', () => this.nextImage());
        
        // События мыши
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        
        // Отключаем контекстное меню
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Обновляем размеры при ресайзе
        window.addEventListener('resize', () => {
            if (this.currentImage) {
                this.updateCanvasSize();
                this.draw();
            }
        });
    }
    
    // ПРОСТОЙ И ПРАВИЛЬНЫЙ метод получения координат
    getImageCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        
        // Координаты мыши относительно канваса
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        // Преобразуем в координаты ИСХОДНОГО изображения
        const imageX = (canvasX / this.displayWidth) * this.imageWidth;
        const imageY = (canvasY / this.displayHeight) * this.imageHeight;
        
        // Ограничиваем координаты
        const boundedX = Math.max(0, Math.min(imageX, this.imageWidth));
        const boundedY = Math.max(0, Math.min(imageY, this.imageHeight));
        
        if (this.debugMode) {
            console.log('=== КООРДИНАТЫ ===');
            console.log('Мышь на странице:', e.clientX, e.clientY);
            console.log('Мышь на канвасе:', canvasX, canvasY);
            console.log('Мышь на изображении:', boundedX, boundedY);
            console.log('Размеры канваса:', this.canvas.width, this.canvas.height);
            console.log('Размеры отображения:', this.displayWidth, this.displayHeight);
            console.log('Размеры изображения:', this.imageWidth, this.imageHeight);
            console.log('Коэффициент масштаба:', this.displayRatio);
        }
        
        return {
            x: boundedX,
            y: boundedY
        };
    }
    
    // Обновляем размер канваса под контейнер
    updateCanvasSize() {
        if (!this.elements.canvasContainer || !this.currentImage) return;
        
        const container = this.elements.canvasContainer;
        const maxWidth = container.clientWidth - 4; // минус границы
        const maxHeight = container.clientHeight - 4;
        
        // Вычисляем размеры для отображения с сохранением пропорций
        let displayWidth = this.imageWidth;
        let displayHeight = this.imageHeight;
        
        // Если изображение больше контейнера - масштабируем
        if (displayWidth > maxWidth || displayHeight > maxHeight) {
            const widthRatio = maxWidth / displayWidth;
            const heightRatio = maxHeight / displayHeight;
            const ratio = Math.min(widthRatio, heightRatio);
            
            displayWidth = Math.floor(displayWidth * ratio);
            displayHeight = Math.floor(displayHeight * ratio);
        }
        
        // Устанавливаем размеры канваса
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        
        // Сохраняем размеры отображения
        this.displayWidth = displayWidth;
        this.displayHeight = displayHeight;
        this.displayRatio = displayWidth / this.imageWidth;
        
        console.log('📐 Размеры канваса обновлены:', {
            canvas: `${this.canvas.width}x${this.canvas.height}`,
            display: `${this.displayWidth}x${this.displayHeight}`,
            original: `${this.imageWidth}x${this.imageHeight}`,
            ratio: this.displayRatio,
            container: `${container.clientWidth}x${container.clientHeight}`
        });
    }
    
    hexToRgba(hex, alpha = 1) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    async loadSingleImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.images = [{
            file: file,
            name: file.name,
            url: URL.createObjectURL(file),
            annotation: null
        }];
        
        this.currentImageIndex = 0;
        await this.displayCurrentImage();
        this.updateUI();
    }
    
    async loadMultipleImages(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        this.images = files.map(file => ({
            file: file,
            name: file.name,
            url: URL.createObjectURL(file),
            annotation: null
        }));
        
        this.currentImageIndex = 0;
        if (this.elements.progressInfo) {
            this.elements.progressInfo.style.display = 'block';
            this.elements.totalCount.textContent = this.images.length;
            this.elements.processedCount.textContent = '0';
            this.elements.progressBar.value = 0;
        }
        
        await this.displayCurrentImage();
        this.updateUI();
    }
    
    async displayCurrentImage() {
        if (this.images.length === 0) return;
        
        const imageData = this.images[this.currentImageIndex];
        this.elements.currentFileName.textContent = imageData.name;
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.imageWidth = img.naturalWidth || img.width;
                this.imageHeight = img.naturalHeight || img.height;
                
                console.log('🖼️ Изображение загружено:', {
                    name: imageData.name,
                    size: `${this.imageWidth}x${this.imageHeight}`,
                    natural: `${img.naturalWidth}x${img.naturalHeight}`
                });
                
                // Обновляем размеры канваса
                this.updateCanvasSize();
                
                // Сбрасываем масштаб
                this.scale = 1;
                
                this.updateZoomDisplay();
                this.draw();
                resolve();
            };
            
            img.onerror = () => {
                alert(`Ошибка загрузки: ${imageData.name}`);
                resolve();
            };
            
            img.src = imageData.url;
        });
    }
    
    draw() {
        if (!this.currentImage) return;
        
        // Очищаем канвас
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Сохраняем контекст
        this.ctx.save();
        
        // Применяем масштаб
        this.ctx.scale(this.scale, this.scale);
        
        // Рисуем изображение
        this.ctx.drawImage(
            this.currentImage,
            0, 0, this.imageWidth, this.imageHeight,
            0, 0, this.displayWidth / this.scale, this.displayHeight / this.scale
        );
        
        // Рисуем сохраненные аннотации
        this.drawSavedAnnotations();
        
        // Рисуем текущую аннотацию
        if (this.currentAnnotation) {
            this.drawAnnotation(this.currentAnnotation);
        }
        
        // Восстанавливаем контекст
        this.ctx.restore();
    }
    
    drawSavedAnnotations() {
        const annotation = this.images[this.currentImageIndex]?.annotation;
        if (!annotation) return;
        
        this.drawAnnotation(annotation);
    }
    
    drawAnnotation(annotation) {
        this.ctx.save();
        this.ctx.scale(this.scale, this.scale);
        
        const { x, y, width, height, type } = annotation;
        
        // Конвертируем координаты из оригинальных в отображаемые
        const displayX = (x / this.imageWidth) * (this.displayWidth / this.scale);
        const displayY = (y / this.imageHeight) * (this.displayHeight / this.scale);
        const displayWidth = (width / this.imageWidth) * (this.displayWidth / this.scale);
        const displayHeight = (height / this.imageHeight) * (this.displayHeight / this.scale);
        
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.fillStyle = this.fillColor;
        this.ctx.lineWidth = 2 / this.scale;
        
        switch(type) {
            case 'rectangle':
                this.ctx.fillRect(displayX, displayY, displayWidth, displayHeight);
                this.ctx.strokeRect(displayX, displayY, displayWidth, displayHeight);
                break;
                
            case 'circle':
                const centerX = displayX;
                const centerY = displayY;
                const radius = Math.max(Math.abs(displayWidth), Math.abs(displayHeight)) / 2;
                
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.stroke();
                break;
                
            case 'freehand':
                if (annotation.points && annotation.points.length > 1) {
                    this.ctx.beginPath();
                    
                    // Конвертируем все точки
                    const firstPoint = annotation.points[0];
                    const firstDisplayX = (firstPoint.x / this.imageWidth) * (this.displayWidth / this.scale);
                    const firstDisplayY = (firstPoint.y / this.imageHeight) * (this.displayHeight / this.scale);
                    this.ctx.moveTo(firstDisplayX, firstDisplayY);
                    
                    for (let i = 1; i < annotation.points.length; i++) {
                        const point = annotation.points[i];
                        const pointX = (point.x / this.imageWidth) * (this.displayWidth / this.scale);
                        const pointY = (point.y / this.imageHeight) * (this.displayHeight / this.scale);
                        this.ctx.lineTo(pointX, pointY);
                    }
                    
                    if (annotation.points.length > 2) {
                        this.ctx.closePath();
                    }
                    
                    this.ctx.fill();
                    this.ctx.stroke();
                }
                break;
        }
        
        this.ctx.restore();
    }
    
    onMouseDown(e) {
        if (!this.currentImage) return;
        
        e.preventDefault();
        
        // Получаем координаты на ИСХОДНОМ изображении
        const imagePos = this.getImageCoords(e);
        
        this.isDrawing = true;
        this.startX = imagePos.x;
        this.startY = imagePos.y;
        
        console.log('🚀 Начало рисования:', {
            координаты_изображения: imagePos,
            инструмент: this.tool,
            startX: this.startX,
            startY: this.startY
        });
        
        if (this.tool === 'freehand') {
            this.currentAnnotation = {
                type: 'freehand',
                points: [{ x: imagePos.x, y: imagePos.y }],
                x: imagePos.x,
                y: imagePos.y,
                width: 0,
                height: 0
            };
        } else if (this.tool === 'circle') {
            this.currentAnnotation = {
                type: 'circle',
                x: imagePos.x,
                y: imagePos.y,
                width: 0,
                height: 0
            };
        } else {
            this.currentAnnotation = {
                type: 'rectangle',
                x: imagePos.x,
                y: imagePos.y,
                width: 0,
                height: 0
            };
        }
        
        this.draw();
    }
    
    onMouseMove(e) {
        if (!this.isDrawing || !this.currentAnnotation) return;
        
        e.preventDefault();
        
        const currentPos = this.getImageCoords(e);
        
        if (this.tool === 'freehand') {
            this.currentAnnotation.points.push({ x: currentPos.x, y: currentPos.y });
            
            const points = this.currentAnnotation.points;
            const xs = points.map(p => p.x);
            const ys = points.map(p => p.y);
            this.currentAnnotation.x = Math.min(...xs);
            this.currentAnnotation.y = Math.min(...ys);
            this.currentAnnotation.width = Math.max(...xs) - this.currentAnnotation.x;
            this.currentAnnotation.height = Math.max(...ys) - this.currentAnnotation.y;
        } else if (this.tool === 'circle') {
            const dx = currentPos.x - this.startX;
            const dy = currentPos.y - this.startY;
            const radius = Math.sqrt(dx * dx + dy * dy);
            
            this.currentAnnotation.width = radius * 2;
            this.currentAnnotation.height = radius * 2;
        } else {
            this.currentAnnotation.width = currentPos.x - this.startX;
            this.currentAnnotation.height = currentPos.y - this.startY;
        }
        
        this.updateAnnotationInfo(this.currentAnnotation);
        this.draw();
    }
    
    onMouseUp(e) {
        if (!this.isDrawing || !this.currentAnnotation) return;
        
        e.preventDefault();
        this.isDrawing = false;
        
        let annotation = { ...this.currentAnnotation };
        
        if (this.tool === 'rectangle') {
            let x = annotation.x;
            let y = annotation.y;
            let width = annotation.width;
            let height = annotation.height;
            
            if (width < 0) {
                x += width;
                width = Math.abs(width);
            }
            if (height < 0) {
                y += height;
                height = Math.abs(height);
            }
            
            annotation.x = Math.max(0, x);
            annotation.y = Math.max(0, y);
            annotation.width = Math.min(width, this.imageWidth - x);
            annotation.height = Math.min(height, this.imageHeight - y);
        }
        
        // Проверяем, что аннотация не слишком маленькая
        if (Math.abs(annotation.width) < 5 || Math.abs(annotation.height) < 5) {
            console.log('⚠️ Аннотация слишком мала, не сохранена');
            this.currentAnnotation = null;
            this.draw();
            return;
        }
        
        // Сохраняем аннотацию
        this.images[this.currentImageIndex].annotation = annotation;
        console.log('✅ Аннотация сохранена:', annotation);
        console.log('📏 Размеры изображения:', this.imageWidth, 'x', this.imageHeight);
        
        // Автосохранение для множественных изображений
        if (this.elements.multipleImagesRadio.checked &&
            this.images.length > 1 &&
            this.currentImageIndex < this.images.length - 1) {
            
            this.saveCurrentAnnotation();
            
            setTimeout(() => {
                this.nextImage();
            }, 500);
        }
        
        this.currentAnnotation = null;
        this.draw();
        this.updateUI();
    }
    
    onWheel(e) {
        e.preventDefault();
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = this.scale * zoomFactor;
        
        if (newScale >= 0.1 && newScale <= 5) {
            this.scale = newScale;
            this.updateZoomDisplay();
            this.draw();
        }
    }
    
    zoom(delta) {
        const newScale = this.scale + delta;
        
        if (newScale >= 0.1 && newScale <= 5) {
            this.scale = newScale;
            this.updateZoomDisplay();
            this.draw();
        }
    }
    
    resetZoom() {
        this.scale = 1;
        this.updateZoomDisplay();
        this.draw();
    }
    
    updateZoomDisplay() {
        this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    }
    
    updateAnnotationInfo(annotation) {
        if (!annotation) {
            this.elements.annotationX.textContent = '0';
            this.elements.annotationY.textContent = '0';
            this.elements.annotationWidth.textContent = '0';
            this.elements.annotationHeight.textContent = '0';
            return;
        }
        
        if (annotation.type === 'circle') {
            this.elements.annotationX.textContent = Math.round(annotation.x);
            this.elements.annotationY.textContent = Math.round(annotation.y);
            this.elements.annotationWidth.textContent = Math.round(annotation.width);
            this.elements.annotationHeight.textContent = Math.round(annotation.height);
        } else {
            this.elements.annotationX.textContent = Math.round(annotation.x);
            this.elements.annotationY.textContent = Math.round(annotation.y);
            this.elements.annotationWidth.textContent = Math.round(Math.abs(annotation.width));
            this.elements.annotationHeight.textContent = Math.round(Math.abs(annotation.height));
        }
    }
    
    clearAnnotation() {
        if (this.images.length === 0) return;
        
        this.images[this.currentImageIndex].annotation = null;
        this.currentAnnotation = null;
        this.updateAnnotationInfo(null);
        this.draw();
    }
    
    // Создание маски для свободной формы
    createMaskImage(annotation) {
        if (!annotation || annotation.type !== 'freehand') return null;
        
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = this.imageWidth;
        maskCanvas.height = this.imageHeight;
        const maskCtx = maskCanvas.getContext('2d');
        
        // Заливаем весь канвас черным цветом
        maskCtx.fillStyle = '#000000';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        
        // Рисуем фигуру белым цветом
        maskCtx.fillStyle = '#FFFFFF';
        maskCtx.strokeStyle = '#FFFFFF';
        
        if (annotation.points && annotation.points.length > 1) {
            maskCtx.beginPath();
            maskCtx.moveTo(annotation.points[0].x, annotation.points[0].y);
            
            for (let i = 1; i < annotation.points.length; i++) {
                maskCtx.lineTo(annotation.points[i].x, annotation.points[i].y);
            }
            
            if (annotation.points.length > 2) {
                maskCtx.closePath();
            }
            
            maskCtx.fill();
        }
        
        return maskCanvas;
    }
    
    // Сохранение изображения
    downloadImage(dataURL, fileName) {
        try {
            const link = document.createElement('a');
            link.href = dataURL;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('🖼️ Файл сохранен:', fileName);
        } catch (error) {
            console.error('❌ Ошибка сохранения файла:', error);
        }
    }
    
    saveCurrentAnnotation() {
        const currentImage = this.images[this.currentImageIndex];
        if (!currentImage || !currentImage.annotation) {
            console.log('⚠️ Нет аннотации для сохранения');
            return null;
        }
        
        const annotation = currentImage.annotation;
        
        // Создаём маску для свободной формы
        let maskDataURL = null;
        let maskFileName = null;
        
        if (annotation.type === 'freehand') {
            const maskCanvas = this.createMaskImage(annotation);
            if (maskCanvas) {
                maskDataURL = maskCanvas.toDataURL('image/png');
                maskFileName = currentImage.name.replace(/\.[^/.]+$/, "") + '_mask.png';
                
                // Сохраняем маску как файл
                this.downloadImage(maskDataURL, maskFileName);
            }
        }
        
        const annotationData = {
            imagePath: currentImage.name,
            maskPath: maskFileName,
            timestamp: new Date().toISOString(),
            tool: annotation.type,
            coordinates: this.getAnnotationCoords(annotation),
            originalImageSize: {
                width: this.imageWidth,
                height: this.imageHeight
            },
            points: annotation.type === 'freehand' ? annotation.points : null
        };
        
        console.log('💾 Сохранение аннотации:', annotationData);
        
        // Сохраняем JSON
        this.downloadAnnotationJSON(annotationData);
        
        // Сохраняем обрезанное изображение (только для прямоугольника и круга)
        if (annotation.type !== 'freehand') {
            this.createCroppedImage(currentImage, annotation);
        }
        
        return annotationData;
    }
    
    getAnnotationCoords(annotation) {
        if (annotation.type === 'circle') {
            const radius = annotation.width / 2;
            return {
                x: Math.round(annotation.x - radius),
                y: Math.round(annotation.y - radius),
                width: Math.round(annotation.width),
                height: Math.round(annotation.height)
            };
        } else {
            return {
                x: Math.round(annotation.x),
                y: Math.round(annotation.y),
                width: Math.round(Math.abs(annotation.width)),
                height: Math.round(Math.abs(annotation.height))
            };
        }
    }
    
    async nextImage() {
        if (this.images.length <= 1) {
            alert('Только одно изображение загружено');
            return;
        }
        
        if (this.images[this.currentImageIndex].annotation) {
            this.saveCurrentAnnotation();
        }
        
        this.currentImageIndex++;
        
        if (this.currentImageIndex >= this.images.length) {
            alert('🎉 Все изображения обработаны!');
            this.currentImageIndex = this.images.length - 1;
            return;
        }
        
        if (this.elements.progressInfo) {
            this.elements.processedCount.textContent = this.currentImageIndex + 1;
            this.elements.progressBar.value = ((this.currentImageIndex + 1) / this.images.length) * 100;
        }
        
        await this.displayCurrentImage();
        this.updateUI();
    }
    
    async createCroppedImage(imageData, annotation) {
        const img = new Image();
        
        return new Promise((resolve) => {
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    const coords = this.getAnnotationCoords(annotation);
                    const width = Math.max(1, coords.width);
                    const height = Math.max(1, coords.height);
                    
                    canvas.width = width;
                    canvas.height = height;
                    
                    ctx.drawImage(
                        img,
                        coords.x, coords.y, width, height,
                        0, 0, width, height
                    );
                    
                    const fileName = imageData.name.replace(/\.[^/.]+$/, "");
                    const croppedName = `${fileName}_cropped.png`;
                    
                    this.downloadImage(canvas.toDataURL('image/png'), croppedName);
                    
                    console.log('🖼️ Обрезано:', croppedName);
                } catch (error) {
                    console.error('❌ Ошибка обрезки:', error);
                }
                resolve();
            };
            
            img.src = imageData.url;
        });
    }
    
    downloadAnnotationJSON(data) {
        try {
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const fileName = data.imagePath.replace(/\.[^/.]+$/, "") + '_annotation.json';
            
            this.downloadImage(url, fileName);
            
            console.log('📄 JSON сохранен:', fileName);
        } catch (error) {
            console.error('❌ Ошибка сохранения JSON:', error);
        }
    }
    
    updateUI() {
        if (this.images.length === 0) return;
        
        const annotation = this.images[this.currentImageIndex]?.annotation;
        this.updateAnnotationInfo(annotation || null);
        
        if (this.elements.multipleImagesRadio.checked && this.elements.progressInfo) {
            this.elements.progressInfo.style.display = 'block';
            this.elements.totalCount.textContent = this.images.length;
            this.elements.processedCount.textContent = this.currentImageIndex + 1;
            this.elements.progressBar.value = ((this.currentImageIndex + 1) / this.images.length) * 100;
        }
    }
    
    exportAllAnnotations() {
        try {
            // Сохраняем текущую
            const currentImage = this.images[this.currentImageIndex];
            if (currentImage && currentImage.annotation) {
                this.saveCurrentAnnotation();
            }
            
            const allAnnotations = this.images
                .filter(img => img.annotation)
                .map(img => ({
                    imagePath: img.name,
                    annotation: img.annotation,
                    timestamp: new Date().toISOString()
                }));
            
            if (allAnnotations.length === 0) {
                alert('⚠️ Нет аннотаций для экспорта');
                return;
            }
            
            const json = JSON.stringify({
                exportDate: new Date().toISOString(),
                totalImages: this.images.length,
                totalAnnotations: allAnnotations.length,
                annotations: allAnnotations
            }, null, 2);
            
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            this.downloadImage(url, 'all_annotations.json');
            
            alert(`✅ Экспортировано ${allAnnotations.length} аннотаций из ${this.images.length} изображений`);
            
        } catch (error) {
            console.error('❌ Ошибка экспорта:', error);
            alert('❌ Ошибка экспорта');
        }
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.annotationTool = new ImageAnnotationTool();
        console.log('✅ Инструмент аннотации готов к работе!');
        
        // Создаем панель отладки
        const debugPanel = document.createElement('div');
        debugPanel.style.margin = '10px 0';
        debugPanel.style.padding = '10px';
        debugPanel.style.backgroundColor = '#333';
        debugPanel.style.color = '#fff';
        debugPanel.style.borderRadius = '5px';
        debugPanel.style.fontSize = '12px';
        debugPanel.style.fontFamily = 'monospace';
        debugPanel.innerHTML = `
            <strong>🔧 Режим отладки ВКЛЮЧЕН</strong><br>
            • Откройте консоль (F12 → Console)<br>
            • При рисовании будут выводиться координаты<br>
            • Проверяйте, что координаты совпадают с положением мыши
        `;
        
        // Кнопки
        const buttons = document.createElement('div');
        buttons.style.margin = '10px 0';
        buttons.style.display = 'flex';
        buttons.style.gap = '10px';
        buttons.style.flexWrap = 'wrap';
        
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '💾 Сохранить текущую';
        saveBtn.className = 'control-btn';
        saveBtn.onclick = () => {
            const saved = window.annotationTool.saveCurrentAnnotation();
            if (saved) {
                alert(`✅ Сохранено!\nФайл: ${saved.imagePath}\nКоординаты: x=${saved.coordinates.x}, y=${saved.coordinates.y}`);
            }
        };
        
        const exportBtn = document.createElement('button');
        exportBtn.textContent = '📦 Экспорт всех';
        exportBtn.className = 'control-btn';
        exportBtn.onclick = () => window.annotationTool.exportAllAnnotations();
        
        const testBtn = document.createElement('button');
        testBtn.textContent = '🧪 Тест координат';
        testBtn.className = 'control-btn';
        testBtn.style.backgroundColor = '#ff9800';
        testBtn.onclick = () => {
            const canvas = document.getElementById('annotation-canvas');
            const rect = canvas.getBoundingClientRect();
            const container = canvas.parentElement;
            alert(`=== ТЕСТ КООРДИНАТ ===

Позиция канваса на странице:
left: ${rect.left}px
top: ${rect.top}px
width: ${rect.width}px
height: ${rect.height}px

Размер контейнера:
width: ${container.clientWidth}px
height: ${container.clientHeight}px

Размер канваса (атрибуты):
width: ${canvas.width}px
height: ${canvas.height}px

Размер изображения:
width: ${window.annotationTool.imageWidth}px
height: ${window.annotationTool.imageHeight}px

Размер отображения:
width: ${window.annotationTool.displayWidth}px
height: ${window.annotationTool.displayHeight}px

Масштаб: ${window.annotationTool.scale}
Коэффициент: ${window.annotationTool.displayRatio}`);
        };
        
        buttons.appendChild(saveBtn);
        buttons.appendChild(exportBtn);
        buttons.appendChild(testBtn);
        
        const toolSection = document.querySelector('.tool-section');
        if (toolSection) {
            toolSection.appendChild(debugPanel);
            toolSection.appendChild(buttons);
        }
        
        // Добавляем инструкцию по проверке
        const checkInstruction = document.createElement('div');
        checkInstruction.style.marginTop = '15px';
        checkInstruction.style.padding = '10px';
        checkInstruction.style.backgroundColor = '#e8f5e9';
        checkInstruction.style.border = '1px solid #4caf50';
        checkInstruction.style.borderRadius = '5px';
        checkInstruction.style.fontSize = '13px';
        checkInstruction.innerHTML = `
            <strong>🎯 Проверка точности рисования:</strong><br>
            1. <strong>Загрузите изображение</strong><br>
            2. <strong>Кликните в ЛЕВЫЙ ВЕРХНИЙ угол изображения</strong><br>
            3. <strong>Потяните до ПРАВОГО НИЖНЕГО угла</strong><br>
            4. <strong>Координаты X,Y должны быть около 0,0</strong><br>
            5. <strong>Ширина и высота должны соответствовать размерам изображения</strong><br>
            6. <strong>Если есть смещение - нажмите "Тест координат"</strong>
        `;
        
        if (toolSection) {
            toolSection.appendChild(checkInstruction);
        }
        
    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        alert('❌ Ошибка загрузки инструмента. Откройте консоль (F12) для деталей.');
    }
});