class ImageAnnotationTool {
    constructor() {
        console.log('🔧 Инициализация приложения...');
        
        this.canvas = document.getElementById('annotationCanvas');
        if (!this.canvas) {
            console.error('❌ Canvas не найден!');
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        
        this.images = [];
        this.currentImageIndex = 0;
        this.currentImage = null;
        this.imageWidth = 0;
        this.imageHeight = 0;
        this.displayWidth = 0;
        this.displayHeight = 0;
        
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentAnnotation = null;
        
        this.tool = 'rectangle';
        this.strokeColor = '#FF6B6B';
        this.fillColor = 'rgba(255, 107, 107, 0.25)';
        this.scale = 1;
        
        // IndexedDB
        this.db = null;
        
        this.elements = {
            singleUpload: document.getElementById('singleUpload'),
            folderUpload: document.getElementById('folderUpload'),
            singleImageRadio: document.getElementById('singleImageRadio'),
            multipleImagesRadio: document.getElementById('multipleImagesRadio'),
            toolType: document.getElementById('toolType'),
            annotationColor: document.getElementById('annotationColor'),
            bgColor: document.getElementById('bgColor'),
            saveCropped: document.getElementById('saveCropped'),
            zoomIn: document.getElementById('zoomIn'),
            zoomOut: document.getElementById('zoomOut'),
            zoomReset: document.getElementById('zoomReset'),
            zoomLevel: document.getElementById('zoomLevel'),
            clearAnnotation: document.getElementById('clearAnnotation'),
            nextImage: document.getElementById('nextImage'),
            saveAnnotation: document.getElementById('saveAnnotation'),
            exportAll: document.getElementById('exportAll'),
            currentFileName: document.getElementById('currentFileName'),
            annotationX: document.getElementById('annotationX'),
            annotationY: document.getElementById('annotationY'),
            annotationWidth: document.getElementById('annotationWidth'),
            annotationHeight: document.getElementById('annotationHeight'),
            processedCount: document.getElementById('processedCount'),
            totalCount: document.getElementById('totalCount'),
            progressBar: document.getElementById('progressBar'),
            progressInfo: document.getElementById('progressInfo'),
            singleUploadLabel: document.getElementById('singleUploadLabel'),
            folderUploadLabel: document.getElementById('folderUploadLabel')
        };
        
        // Запускаем инициализацию
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        await this.initDB();
        console.log('✅ Инструмент разметки готов!');
    }
    
    // Инициализация IndexedDB
    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('AnnotationToolDB', 3);
            
            request.onerror = () => {
                console.error('❌ Ошибка открытия БД');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB подключена');
                this.restoreSession();
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('images')) {
                    const imageStore = db.createObjectStore('images', { keyPath: 'id' });
                    imageStore.createIndex('name', 'name', { unique: false });
                    imageStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('📁 Создано хранилище images');
                }
                
                if (!db.objectStoreNames.contains('sessions')) {
                    db.createObjectStore('sessions', { keyPath: 'id' });
                    console.log('📁 Создано хранилище sessions');
                }
            };
        });
    }
    
    // Сохранение изображения в IndexedDB
    async saveImageToDB(file, annotation = null) {
        const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = {
                    id: id,
                    name: file.name,
                    data: e.target.result,
                    annotation: annotation,
                    timestamp: Date.now(),
                    webkitRelativePath: file.webkitRelativePath || ''
                };
                
                const transaction = this.db.transaction(['images'], 'readwrite');
                const store = transaction.objectStore('images');
                const request = store.add(imageData);
                
                request.onsuccess = () => {
                    console.log(`💾 Изображение сохранено в БД: ${file.name}`);
                    resolve(id);
                };
                request.onerror = () => reject(request.error);
            };
            reader.readAsDataURL(file);
        });
    }
    
    // Получение изображения из IndexedDB
    async getImageFromDB(id) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Обновление аннотации в БД
    async updateAnnotationInDB(imageId, annotation) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            
            const getRequest = store.get(imageId);
            
            getRequest.onsuccess = () => {
                const imageData = getRequest.result;
                if (imageData) {
                    imageData.annotation = annotation;
                    const putRequest = store.put(imageData);
                    putRequest.onsuccess = () => {
                        console.log(`💾 Разметка обновлена в БД`);
                        resolve();
                    };
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve();
                }
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }
    
    // Сохранение сессии
    async saveSession() {
        if (!this.db) return;
        
        try {
            let mode = 'single';
            if (this.elements.multipleImagesRadio && this.elements.multipleImagesRadio.checked) {
                mode = 'multiple';
            }
            
            const session = {
                id: 'current_session',
                mode: mode,
                tool: this.tool,
                strokeColor: this.strokeColor,
                bgColor: this.elements.bgColor ? this.elements.bgColor.value : '#FFB347',
                saveCropped: this.elements.saveCropped ? this.elements.saveCropped.checked : true,
                currentImageIndex: this.currentImageIndex,
                imageIds: this.images.map(img => img.id),
                timestamp: Date.now()
            };
            
            const transaction = this.db.transaction(['sessions'], 'readwrite');
            const store = transaction.objectStore('sessions');
            await store.put(session);
            
            console.log('💾 Сессия сохранена, изображений:', this.images.length);
        } catch (e) {
            console.error('Ошибка сохранения сессии:', e);
        }
    }
    
    // Восстановление сессии
    async restoreSession() {
        if (!this.db) return;
        
        try {
            const transaction = this.db.transaction(['sessions'], 'readonly');
            const store = transaction.objectStore('sessions');
            const session = await new Promise((resolve) => {
                const request = store.get('current_session');
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(null);
            });
            
            if (!session) {
                console.log('📭 Нет сохраненной сессии');
                return;
            }
            
            console.log('🔄 Восстанавливаем сессию от', new Date(session.timestamp).toLocaleString());
            
            // Восстанавливаем настройки
            if (session.mode === 'multiple') {
                if (this.elements.multipleImagesRadio) this.elements.multipleImagesRadio.checked = true;
                if (this.elements.singleImageRadio) this.elements.singleImageRadio.checked = false;
                if (this.elements.singleUploadLabel) this.elements.singleUploadLabel.style.display = 'none';
                if (this.elements.folderUploadLabel) this.elements.folderUploadLabel.style.display = 'inline-block';
                if (this.elements.nextImage) this.elements.nextImage.style.display = 'block';
            } else {
                if (this.elements.singleImageRadio) this.elements.singleImageRadio.checked = true;
                if (this.elements.multipleImagesRadio) this.elements.multipleImagesRadio.checked = false;
                if (this.elements.singleUploadLabel) this.elements.singleUploadLabel.style.display = 'inline-block';
                if (this.elements.folderUploadLabel) this.elements.folderUploadLabel.style.display = 'none';
                if (this.elements.nextImage) this.elements.nextImage.style.display = 'none';
            }
            
            this.tool = session.tool || 'rectangle';
            if (this.elements.toolType) this.elements.toolType.value = this.tool;
            this.strokeColor = session.strokeColor || '#FF6B6B';
            if (this.elements.annotationColor) this.elements.annotationColor.value = this.strokeColor;
            if (this.elements.bgColor) {
                this.elements.bgColor.value = session.bgColor || '#FFB347';
                const r = parseInt(session.bgColor.slice(1, 3), 16);
                const g = parseInt(session.bgColor.slice(3, 5), 16);
                const b = parseInt(session.bgColor.slice(5, 7), 16);
                this.fillColor = `rgba(${r}, ${g}, ${b}, 0.25)`;
            }
            if (this.elements.saveCropped) this.elements.saveCropped.checked = session.saveCropped !== false;
            
            // Восстанавливаем изображения
            if (session.imageIds && session.imageIds.length > 0) {
                console.log(`🖼️ Восстанавливаем ${session.imageIds.length} изображений...`);
                this.images = [];
                
                for (const id of session.imageIds) {
                    const imgData = await this.getImageFromDB(id);
                    if (imgData) {
                        const response = await fetch(imgData.data);
                        const blob = await response.blob();
                        const file = new File([blob], imgData.name, { type: blob.type });
                        
                        this.images.push({
                            id: imgData.id,
                            file: file,
                            name: imgData.name,
                            url: URL.createObjectURL(file),
                            annotation: imgData.annotation,
                            webkitRelativePath: imgData.webkitRelativePath
                        });
                    }
                }
                
                if (this.images.length > 0) {
                    this.currentImageIndex = Math.min(session.currentImageIndex || 0, this.images.length - 1);
                    
                    if (session.mode === 'multiple' && this.elements.progressInfo) {
                        this.elements.progressInfo.style.display = 'block';
                        if (this.elements.totalCount) this.elements.totalCount.textContent = this.images.length;
                        if (this.elements.processedCount) this.elements.processedCount.textContent = this.currentImageIndex + 1;
                        if (this.elements.progressBar) this.elements.progressBar.value = ((this.currentImageIndex + 1) / this.images.length) * 100;
                    }
                    
                    await this.displayCurrentImage();
                    this.updateUI();
                    console.log(`✅ Восстановлено ${this.images.length} изображений`);
                }
            }
        } catch (e) {
            console.error('Ошибка восстановления сессии:', e);
        }
    }
    
    setupEventListeners() {
        console.log('🎯 Настройка обработчиков событий...');
        
        // Загрузка файлов
        if (this.elements.singleUpload) {
            this.elements.singleUpload.addEventListener('change', (e) => this.loadSingleImage(e));
        }
        if (this.elements.folderUpload) {
            this.elements.folderUpload.addEventListener('change', (e) => this.loadFolderImages(e));
        }
        
        if (this.elements.singleUploadLabel) {
            this.elements.singleUploadLabel.addEventListener('click', () => {
                if (this.elements.singleUpload) this.elements.singleUpload.click();
            });
        }
        if (this.elements.folderUploadLabel) {
            this.elements.folderUploadLabel.addEventListener('click', () => {
                if (this.elements.folderUpload) this.elements.folderUpload.click();
            });
        }
        
        // Переключение режимов
        if (this.elements.singleImageRadio) {
            this.elements.singleImageRadio.addEventListener('change', () => {
                if (this.elements.singleUploadLabel) this.elements.singleUploadLabel.style.display = 'inline-block';
                if (this.elements.folderUploadLabel) this.elements.folderUploadLabel.style.display = 'none';
                if (this.elements.nextImage) this.elements.nextImage.style.display = 'none';
                if (this.elements.progressInfo) this.elements.progressInfo.style.display = 'none';
                this.saveSession();
            });
        }
        
        if (this.elements.multipleImagesRadio) {
            this.elements.multipleImagesRadio.addEventListener('change', () => {
                if (this.elements.singleUploadLabel) this.elements.singleUploadLabel.style.display = 'none';
                if (this.elements.folderUploadLabel) this.elements.folderUploadLabel.style.display = 'inline-block';
                if (this.elements.nextImage) this.elements.nextImage.style.display = 'block';
                this.saveSession();
            });
        }
        
        // Инструменты
        if (this.elements.toolType) {
            this.elements.toolType.addEventListener('change', (e) => {
                this.tool = e.target.value;
                this.saveSession();
            });
        }
        
        if (this.elements.annotationColor) {
            this.elements.annotationColor.addEventListener('input', (e) => {
                this.strokeColor = e.target.value;
                this.draw();
                this.saveSession();
            });
        }
        
        if (this.elements.bgColor) {
            this.elements.bgColor.addEventListener('input', (e) => {
                const r = parseInt(e.target.value.slice(1, 3), 16);
                const g = parseInt(e.target.value.slice(3, 5), 16);
                const b = parseInt(e.target.value.slice(5, 7), 16);
                this.fillColor = `rgba(${r}, ${g}, ${b}, 0.25)`;
                this.draw();
                this.saveSession();
            });
        }
        
        // Масштаб
        if (this.elements.zoomIn) this.elements.zoomIn.addEventListener('click', () => this.zoomIn());
        if (this.elements.zoomOut) this.elements.zoomOut.addEventListener('click', () => this.zoomOut());
        if (this.elements.zoomReset) this.elements.zoomReset.addEventListener('click', () => this.resetZoom());
        
        // Кнопки
        if (this.elements.clearAnnotation) this.elements.clearAnnotation.addEventListener('click', () => this.clearAnnotation());
        if (this.elements.nextImage) this.elements.nextImage.addEventListener('click', () => this.nextImage());
        if (this.elements.saveAnnotation) this.elements.saveAnnotation.addEventListener('click', () => this.saveCurrentAnnotation());
        if (this.elements.exportAll) this.elements.exportAll.addEventListener('click', () => this.exportAllAnnotations());
        
        // События мыши на canvas
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
            this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
            this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
            this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        }
        
        window.addEventListener('resize', () => {
            if (this.currentImage) {
                this.updateCanvasSize();
                this.draw();
            }
        });
        
        window.addEventListener('beforeunload', () => {
            this.saveSession();
        });
        
        console.log('✅ Все обработчики настроены');
    }
    
    updateCanvasSize() {
        if (!this.currentImage) return;
        
        const container = this.canvas.parentElement;
        const maxWidth = container.clientWidth - 40;
        const maxHeight = 500;
        
        let width = this.imageWidth;
        let height = this.imageHeight;
        
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.floor(width * ratio);
            height = Math.floor(height * ratio);
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.displayWidth = width;
        this.displayHeight = height;
    }
    
    zoomIn() {
        this.scale = Math.min(this.scale + 0.1, 3);
        if (this.elements.zoomLevel) {
            this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
        }
        this.draw();
    }
    
    zoomOut() {
        this.scale = Math.max(this.scale - 0.1, 0.3);
        if (this.elements.zoomLevel) {
            this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
        }
        this.draw();
    }
    
    resetZoom() {
        this.scale = 1;
        if (this.elements.zoomLevel) {
            this.elements.zoomLevel.textContent = '100%';
        }
        this.draw();
    }
    
    getImageCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        let canvasX = (e.clientX - rect.left) * scaleX;
        let canvasY = (e.clientY - rect.top) * scaleY;
        
        canvasX = Math.max(0, Math.min(canvasX, this.canvas.width));
        canvasY = Math.max(0, Math.min(canvasY, this.canvas.height));
        
        const imageX = (canvasX / this.displayWidth) * this.imageWidth;
        const imageY = (canvasY / this.displayHeight) * this.imageHeight;
        
        return {
            x: Math.max(0, Math.min(imageX, this.imageWidth)),
            y: Math.max(0, Math.min(imageY, this.imageHeight))
        };
    }
    
    async loadSingleImage(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        console.log('📂 Загрузка изображения:', file.name);
        
        const id = await this.saveImageToDB(file);
        
        this.images = [{
            id: id,
            file: file,
            name: file.name,
            url: URL.createObjectURL(file),
            annotation: null
        }];
        
        this.currentImageIndex = 0;
        await this.displayCurrentImage();
        this.updateUI();
        await this.saveSession();
    }
    
    async loadFolderImages(event) {
        const files = Array.from(event.target.files).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return;
        
        console.log(`📂 Загрузка папки: ${files.length} изображений`);
        
        this.images = [];
        for (const file of files) {
            const id = await this.saveImageToDB(file);
            this.images.push({
                id: id,
                file: file,
                name: file.name,
                url: URL.createObjectURL(file),
                annotation: null,
                webkitRelativePath: file.webkitRelativePath
            });
        }
        
        this.currentImageIndex = 0;
        
        if (this.elements.progressInfo) {
            this.elements.progressInfo.style.display = 'block';
            if (this.elements.totalCount) this.elements.totalCount.textContent = this.images.length;
            if (this.elements.processedCount) this.elements.processedCount.textContent = '1';
            if (this.elements.progressBar) this.elements.progressBar.value = (1 / this.images.length) * 100;
        }
        
        await this.displayCurrentImage();
        this.updateUI();
        await this.saveSession();
    }
    
    async displayCurrentImage() {
        if (this.images.length === 0) return;
        
        const imageData = this.images[this.currentImageIndex];
        if (this.elements.currentFileName) {
            this.elements.currentFileName.textContent = imageData.name;
        }
        
        console.log('🖼️ Отображение:', imageData.name);
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.imageWidth = img.width;
                this.imageHeight = img.height;
                this.updateCanvasSize();
                this.scale = 1;
                if (this.elements.zoomLevel) this.elements.zoomLevel.textContent = '100%';
                this.draw();
                resolve();
            };
            img.onerror = () => {
                console.error('Ошибка загрузки:', imageData.name);
                resolve();
            };
            img.src = imageData.url;
        });
    }
    
    draw() {
        if (!this.currentImage || !this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const scaledW = this.displayWidth * this.scale;
        const scaledH = this.displayHeight * this.scale;
        const offsetX = (this.canvas.width - scaledW) / 2;
        const offsetY = (this.canvas.height - scaledH) / 2;
        
        this.ctx.drawImage(this.currentImage, 0, 0, this.imageWidth, this.imageHeight, offsetX, offsetY, scaledW, scaledH);
        
        const annotation = this.images[this.currentImageIndex]?.annotation;
        if (annotation) {
            this.drawAnnotation(annotation, offsetX, offsetY, scaledW, scaledH);
        }
        
        if (this.currentAnnotation) {
            this.drawAnnotation(this.currentAnnotation, offsetX, offsetY, scaledW, scaledH);
        }
    }
    
    drawAnnotation(annotation, offsetX, offsetY, scaledW, scaledH) {
        if (!annotation) return;
        
        const x = offsetX + (annotation.x / this.imageWidth) * scaledW;
        const y = offsetY + (annotation.y / this.imageHeight) * scaledH;
        const w = (Math.abs(annotation.width) / this.imageWidth) * scaledW;
        const h = (Math.abs(annotation.height) / this.imageHeight) * scaledH;
        
        this.ctx.save();
        this.ctx.strokeStyle = this.strokeColor;
        this.ctx.fillStyle = this.fillColor;
        this.ctx.lineWidth = 2;
        
        if (annotation.type === 'rectangle') {
            this.ctx.fillRect(x, y, w, h);
            this.ctx.strokeRect(x, y, w, h);
        } else if (annotation.type === 'circle') {
            const centerX = x + w / 2;
            const centerY = y + h / 2;
            const radius = Math.min(w, h) / 2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
        } else if (annotation.type === 'freehand' && annotation.points) {
            this.ctx.beginPath();
            const first = annotation.points[0];
            this.ctx.moveTo(offsetX + (first.x / this.imageWidth) * scaledW, offsetY + (first.y / this.imageHeight) * scaledH);
            for (let i = 1; i < annotation.points.length; i++) {
                const p = annotation.points[i];
                this.ctx.lineTo(offsetX + (p.x / this.imageWidth) * scaledW, offsetY + (p.y / this.imageHeight) * scaledH);
            }
            this.ctx.fill();
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }
    
    // Сохранение обрезанного фрагмента
    saveCroppedImage(annotation, imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                try {
                    let x = Math.round(annotation.x);
                    let y = Math.round(annotation.y);
                    let width = Math.round(Math.abs(annotation.width));
                    let height = Math.round(Math.abs(annotation.height));
                    
                    x = Math.max(0, Math.min(x, this.imageWidth));
                    y = Math.max(0, Math.min(y, this.imageHeight));
                    width = Math.min(width, this.imageWidth - x);
                    height = Math.min(height, this.imageHeight - y);
                    
                    if (width <= 0 || height <= 0) {
                        console.log('Область слишком мала');
                        resolve(false);
                        return;
                    }
                    
                    const cropCanvas = document.createElement('canvas');
                    cropCanvas.width = width;
                    cropCanvas.height = height;
                    const cropCtx = cropCanvas.getContext('2d');
                    
                    cropCtx.drawImage(img, x, y, width, height, 0, 0, width, height);
                    
                    cropCanvas.toBlob((blob) => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        const baseName = imageData.name.replace(/\.[^/.]+$/, '');
                        a.href = url;
                        a.download = `${baseName}_cropped_${Date.now()}.png`;
                        a.click();
                        URL.revokeObjectURL(url);
                        console.log('✅ Фрагмент сохранен');
                        resolve(true);
                    }, 'image/png');
                } catch (error) {
                    console.error('Ошибка:', error);
                    resolve(false);
                }
            };
            img.src = imageData.url;
        });
    }
    
    onMouseDown(e) {
        if (!this.currentImage) return;
        e.preventDefault();
        
        const coords = this.getImageCoords(e);
        this.isDrawing = true;
        this.startX = coords.x;
        this.startY = coords.y;
        
        if (this.tool === 'freehand') {
            this.currentAnnotation = {
                type: 'freehand',
                points: [{ x: coords.x, y: coords.y }],
                x: coords.x,
                y: coords.y,
                width: 0,
                height: 0
            };
        } else {
            this.currentAnnotation = {
                type: this.tool,
                x: coords.x,
                y: coords.y,
                width: 0,
                height: 0
            };
        }
    }
    
    onMouseMove(e) {
        if (!this.isDrawing || !this.currentAnnotation) return;
        e.preventDefault();
        
        const coords = this.getImageCoords(e);
        
        if (this.tool === 'freehand') {
            this.currentAnnotation.points.push({ x: coords.x, y: coords.y });
            const xs = this.currentAnnotation.points.map(p => p.x);
            const ys = this.currentAnnotation.points.map(p => p.y);
            this.currentAnnotation.x = Math.min(...xs);
            this.currentAnnotation.y = Math.min(...ys);
            this.currentAnnotation.width = Math.max(...xs) - this.currentAnnotation.x;
            this.currentAnnotation.height = Math.max(...ys) - this.currentAnnotation.y;
        } else {
            this.currentAnnotation.width = coords.x - this.startX;
            this.currentAnnotation.height = coords.y - this.startY;
        }
        
        this.updateInfo(this.currentAnnotation);
        this.draw();
    }
    
    async onMouseUp(e) {
        if (!this.isDrawing || !this.currentAnnotation) return;
        
        this.isDrawing = false;
        
        let ann = { ...this.currentAnnotation };
        
        if (ann.type !== 'freehand') {
            let x = ann.x, y = ann.y, w = ann.width, h = ann.height;
            if (w < 0) { x += w; w = Math.abs(w); }
            if (h < 0) { y += h; h = Math.abs(h); }
            ann.x = Math.max(0, Math.min(x, this.imageWidth));
            ann.y = Math.max(0, Math.min(y, this.imageHeight));
            ann.width = Math.min(w, this.imageWidth - ann.x);
            ann.height = Math.min(h, this.imageHeight - ann.y);
        }
        
        if (Math.abs(ann.width) > 5 && Math.abs(ann.height) > 5) {
            this.images[this.currentImageIndex].annotation = ann;
            await this.updateAnnotationInDB(this.images[this.currentImageIndex].id, ann);
            console.log('✅ Аннотация сохранена в БД');
        }
        
        this.currentAnnotation = null;
        this.draw();
        this.updateUI();
        await this.saveSession();
    }
    
    updateInfo(annotation) {
        if (!annotation) return;
        if (this.elements.annotationX) this.elements.annotationX.textContent = Math.round(annotation.x);
        if (this.elements.annotationY) this.elements.annotationY.textContent = Math.round(annotation.y);
        if (this.elements.annotationWidth) this.elements.annotationWidth.textContent = Math.round(Math.abs(annotation.width));
        if (this.elements.annotationHeight) this.elements.annotationHeight.textContent = Math.round(Math.abs(annotation.height));
    }
    
    async clearAnnotation() {
        if (this.images.length === 0) return;
        this.images[this.currentImageIndex].annotation = null;
        await this.updateAnnotationInDB(this.images[this.currentImageIndex].id, null);
        this.currentAnnotation = null;
        if (this.elements.annotationX) this.elements.annotationX.textContent = '0';
        if (this.elements.annotationY) this.elements.annotationY.textContent = '0';
        if (this.elements.annotationWidth) this.elements.annotationWidth.textContent = '0';
        if (this.elements.annotationHeight) this.elements.annotationHeight.textContent = '0';
        this.draw();
        await this.saveSession();
        alert('🗑️ Разметка удалена');
    }
    
    async saveCurrentAnnotation() {
        const img = this.images[this.currentImageIndex];
        if (!img || !img.annotation) {
            alert('⚠️ Нет разметки для сохранения');
            return;
        }
        
        console.log('💾 Сохранение разметки для:', img.name);
        
        // Сохраняем JSON
        const data = {
            imageName: img.name,
            annotation: img.annotation,
            timestamp: new Date().toISOString(),
            imageSize: { width: this.imageWidth, height: this.imageHeight }
        };
        
        const json = JSON.stringify(data, null, 2);
        const jsonBlob = new Blob([json], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonA = document.createElement('a');
        jsonA.href = jsonUrl;
        jsonA.download = `${img.name.replace(/\.[^/.]+$/, '')}_annotation.json`;
        jsonA.click();
        URL.revokeObjectURL(jsonUrl);
        
        // Сохраняем обрезанный фрагмент
        if (this.elements.saveCropped && this.elements.saveCropped.checked) {
            await this.saveCroppedImage(img.annotation, img);
            alert('✅ Разметка и обрезанный фрагмент сохранены!');
        } else {
            alert('✅ Разметка сохранена!');
        }
    }
    
    async nextImage() {
        if (this.images.length <= 1) {
            alert('📷 Загрузите папку с несколькими изображениями');
            return;
        }
        this.currentImageIndex = (this.currentImageIndex + 1) % this.images.length;
        if (this.elements.processedCount) this.elements.processedCount.textContent = this.currentImageIndex + 1;
        if (this.elements.progressBar) this.elements.progressBar.value = ((this.currentImageIndex + 1) / this.images.length) * 100;
        await this.displayCurrentImage();
        this.updateUI();
        await this.saveSession();
    }
    
    async exportAllAnnotations() {
        const annotations = this.images.filter(img => img.annotation);
        if (annotations.length === 0) {
            alert('⚠️ Нет разметки для экспорта');
            return;
        }
        
        console.log(`📦 Экспорт ${annotations.length} разметок`);
        
        // Сохраняем общий JSON
        const data = {
            exportDate: new Date().toISOString(),
            totalAnnotations: annotations.length,
            annotations: annotations.map(img => ({
                imageName: img.name,
                annotation: img.annotation
            }))
        };
        
        const json = JSON.stringify(data, null, 2);
        const jsonBlob = new Blob([json], { type: 'application/json' });
        const jsonUrl = URL.createObjectURL(jsonBlob);
        const jsonA = document.createElement('a');
        jsonA.href = jsonUrl;
        jsonA.download = `all_annotations_${Date.now()}.json`;
        jsonA.click();
        URL.revokeObjectURL(jsonUrl);
        
        // Сохраняем фрагменты
        if (this.elements.saveCropped && this.elements.saveCropped.checked) {
            alert(`📦 Экспортировано ${annotations.length} разметок. Сохраняю фрагменты...`);
            for (let i = 0; i < annotations.length; i++) {
                await this.saveCroppedImage(annotations[i].annotation, annotations[i]);
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            alert(`✅ Сохранено ${annotations.length} фрагментов!`);
        } else {
            alert(`📦 Экспортировано ${annotations.length} разметок`);
        }
    }
    
    updateUI() {
        if (this.images.length === 0) return;
        const ann = this.images[this.currentImageIndex]?.annotation;
        if (ann) {
            this.updateInfo(ann);
        } else {
            if (this.elements.annotationX) this.elements.annotationX.textContent = '0';
            if (this.elements.annotationY) this.elements.annotationY.textContent = '0';
            if (this.elements.annotationWidth) this.elements.annotationWidth.textContent = '0';
            if (this.elements.annotationHeight) this.elements.annotationHeight.textContent = '0';
        }
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ImageAnnotationTool();
});