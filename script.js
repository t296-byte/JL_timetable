document.addEventListener('DOMContentLoaded', () => {
    const scheduleGridBody = document.getElementById('scheduleGridBody');
    const addScheduleBtn = document.getElementById('addScheduleBtn');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const scheduleModal = document.getElementById('scheduleModal');
    const closeButton = document.querySelector('.close-button');
    const scheduleTextarea = document.getElementById('scheduleTextarea');
    const colorOptions = document.querySelector('.color-options');
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');
    const copyScheduleBtn = document.getElementById('copyScheduleBtn');

    // 新增日期功能相關元素
    const startDatePicker = document.getElementById('startDatePicker');
    const dayLabels = document.querySelectorAll('.day-label');

    // 新增數據操作相關元素
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataInput = document.getElementById('importDataInput');
    const importDataBtn = document.getElementById('importDataBtn');
    const clearAllSchedulesBtn = document.getElementById('clearAllSchedulesBtn');

    let currentScheduleId = null;
    let selectedColor = 'blue';

    let schedules = JSON.parse(localStorage.getItem('schedules')) || {};
    let history = [];
    let historyIndex = -1;

    const timeSlots = [];
    for (let i = 7; i <= 23; i++) {
        timeSlots.push(`${String(i).padStart(2, '0')}:00`);
        if (i < 23) {
            timeSlots.push(`${String(i).padStart(2, '0')}:30`);
        } else if (i === 23) {
            timeSlots.push(`${String(i).padStart(2, '0')}:30`);
        }
    }
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

    // --- 日期功能 ---
    let currentSundayDate = new Date();
    currentSundayDate.setDate(currentSundayDate.getDate() - currentSundayDate.getDay());
    currentSundayDate.setHours(0, 0, 0, 0);

    function formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseDate(dateString) {
        const [year, month, day] = dateString.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    function updateDayLabels() {
        const tempDate = new Date(currentSundayDate);
        dayLabels.forEach((label, index) => {
            const date = new Date(tempDate);
            date.setDate(tempDate.getDate() + index);
            label.textContent = `${days[index]} (${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')})`;
        });
    }

    function initDatePicker() {
        const savedDate = localStorage.getItem('currentSundayDate');
        if (savedDate) {
            currentSundayDate = parseDate(savedDate);
        }
        startDatePicker.value = formatDate(currentSundayDate);
        updateDayLabels();
    }

    startDatePicker.addEventListener('change', (e) => {
        currentSundayDate = parseDate(e.target.value);
        currentSundayDate.setDate(currentSundayDate.getDate() - currentSundayDate.getDay());
        currentSundayDate.setHours(0, 0, 0, 0);
        localStorage.setItem('currentSundayDate', formatDate(currentSundayDate));
        updateDayLabels();
        renderSchedules();
    });

    // --- 網格初始化與渲染 ---
    function initGrid() {
        scheduleGridBody.innerHTML = '';

        timeSlots.forEach(time => {
            const timeCell = document.createElement('div');
            timeCell.classList.add('time-cell');
            timeCell.textContent = time;
            timeCell.dataset.time = time;
            scheduleGridBody.appendChild(timeCell);

            days.forEach((day, dayIndex) => {
                const scheduleCell = document.createElement('div');
                scheduleCell.classList.add('schedule-cell');
                scheduleCell.dataset.time = time;
                scheduleCell.dataset.dayIndex = dayIndex;
                scheduleCell.id = `cell-${dayIndex}-${time.replace(':', '-')}`;

                scheduleCell.addEventListener('dragover', handleDragOver);
                scheduleCell.addEventListener('dragleave', handleDragLeave);
                scheduleCell.addEventListener('drop', handleDrop);

                scheduleGridBody.appendChild(scheduleCell);
            });
        });
        initDatePicker();
        renderSchedules();
        addToHistory();
    }

    function renderSchedules() {
        document.querySelectorAll('.schedule-item').forEach(item => item.remove());
        
        document.querySelectorAll('.time-cell, .schedule-cell').forEach(cell => {
            cell.style.height = '';
            cell.style.minHeight = '40px';
        });

        Object.values(schedules).forEach(schedule => {
            if (schedule.dayIndex !== -1 && schedule.startTime !== '') {
                const cell = document.getElementById(`cell-${schedule.dayIndex}-${schedule.startTime.replace(':', '-')}`);
                if (cell) {
                    const scheduleItem = createScheduleItemElement(schedule);
                    cell.appendChild(scheduleItem);
                }
            } else {
                const existingTempItem = document.querySelector(`.schedule-item[data-id="${schedule.id}"].new-draggable`);
                if (!existingTempItem) {
                    const tempItem = createScheduleItemElement(schedule);
                    tempItem.classList.add('new-draggable');
                    tempItem.style.position = 'fixed';
                    tempItem.style.left = '50%';
                    tempItem.style.top = '50%';
                    tempItem.style.transform = 'translate(-50%, -50%)';
                    tempItem.style.zIndex = '1000';
                    tempItem.style.width = '200px';
                    tempItem.style.height = 'auto';
                    tempItem.style.minHeight = '60px';
                    document.body.appendChild(tempItem);
                }
            }
        });
        setTimeout(adjustRowHeights, 0);
    }

    function createScheduleItemElement(schedule) {
        const scheduleItem = document.createElement('div');
        scheduleItem.classList.add('schedule-item', `color-${schedule.color}`);
        scheduleItem.dataset.id = schedule.id;
        scheduleItem.dataset.dayIndex = schedule.dayIndex;
        scheduleItem.dataset.startTime = schedule.startTime;
        scheduleItem.setAttribute('draggable', true);

        const contentWrapper = document.createElement('div');
        contentWrapper.classList.add('content');

        const lines = schedule.content.split('\n');
        const isTodoList = lines.some(line => line.trim().startsWith('*'));

        if (isTodoList) {
            const todoList = document.createElement('ul');
            todoList.classList.add('todo-list');
            lines.forEach((line, index) => {
                if (line.trim().startsWith('*')) {
                    const todoItem = document.createElement('li');
                    todoItem.classList.add('todo-item');

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = schedule.todoStates?.[index] || false;
                    checkbox.addEventListener('change', () => {
                        if (!schedule.todoStates) {
                            schedule.todoStates = {};
                        }
                        schedule.todoStates[index] = checkbox.checked;
                        if (checkbox.checked) {
                            todoItem.classList.add('completed');
                        } else {
                            todoItem.classList.remove('completed');
                        }
                        saveSchedules();
                    });
                    todoItem.appendChild(checkbox);

                    const todoText = document.createElement('span');
                    todoText.classList.add('todo-text');
                    todoText.textContent = line.substring(1).trim();
                    todoItem.appendChild(todoText);

                    if (checkbox.checked) {
                        todoItem.classList.add('completed');
                    }
                    todoList.appendChild(todoItem);
                } else if (line.trim() !== '') {
                    const p = document.createElement('p');
                    p.classList.add('pure-text-list-item');
                    p.textContent = line.trim();
                    todoList.appendChild(p);
                }
            });
            contentWrapper.appendChild(todoList);
        } else {
            contentWrapper.classList.add('pure-text');
            contentWrapper.textContent = schedule.content;
        }

        scheduleItem.appendChild(contentWrapper);

        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.innerHTML = '&times;';
        deleteBtn.title = '刪除排程';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteSchedule(schedule.id);
        });
        scheduleItem.appendChild(deleteBtn);

        contentWrapper.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
                return;
            }
            openScheduleModal(schedule.id);
        });
        
        scheduleItem.addEventListener('dragstart', handleDragStart);

        return scheduleItem;
    }

    function adjustRowHeights() {
        const defaultMinCellHeight = 50;
        
        timeSlots.forEach(time => {
            let maxRowHeight = 0;
            const cellsInRow = document.querySelectorAll(`.schedule-cell[data-time="${time}"]`);
            
            cellsInRow.forEach(cell => {
                if (cell.scrollHeight > maxRowHeight) {
                    maxRowHeight = cell.scrollHeight;
                }
            });

            maxRowHeight = Math.max(defaultMinCellHeight, maxRowHeight);
            
            const timeCell = document.querySelector(`.time-cell[data-time="${time}"]`);
            if (timeCell) {
                timeCell.style.height = `${maxRowHeight}px`;
            }
            cellsInRow.forEach(cell => {
                cell.style.height = `${maxRowHeight}px`;
            });
        });
    }

    function saveSchedules() {
        localStorage.setItem('schedules', JSON.stringify(schedules));
        addToHistory();
    }

    function addToHistory() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(JSON.parse(JSON.stringify(schedules)));
        historyIndex = history.length - 1;
        updateUndoRedoButtons();
    }

    undoBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            schedules = JSON.parse(JSON.stringify(history[historyIndex]));
            renderSchedules();
            updateUndoRedoButtons();
        }
    });

    redoBtn.addEventListener('click', () => {
        if (historyIndex < history.length - 1) {
            historyIndex++;
            schedules = JSON.parse(JSON.stringify(history[historyIndex]));
            renderSchedules();
            updateUndoRedoButtons();
        }
    });

    function updateUndoRedoButtons() {
        undoBtn.disabled = historyIndex <= 0;
        redoBtn.disabled = historyIndex >= history.length - 1;
    }

    function openScheduleModal(id = null) {
        currentScheduleId = id;
        scheduleTextarea.value = '';
        selectedColor = 'blue';

        document.querySelectorAll('.color-box').forEach(box => {
            box.classList.remove('active');
            if (box.dataset.color === 'blue') {
                box.classList.add('active');
            }
        });

        if (id) {
            const schedule = schedules[id];
            if (schedule) {
                scheduleTextarea.value = schedule.content;
                selectedColor = schedule.color;
                document.querySelectorAll('.color-box').forEach(box => {
                    box.classList.remove('active');
                    if (box.dataset.color === selectedColor) {
                        box.classList.add('active');
                    }
                });
            }
            copyScheduleBtn.style.display = 'inline-block';
        } else {
            copyScheduleBtn.style.display = 'none';
        }
        scheduleModal.style.display = 'flex';
    }

    function closeScheduleModal() {
        scheduleModal.style.display = 'none';
        currentScheduleId = null;
    }

    function saveOrUpdateSchedule() {
        const content = scheduleTextarea.value.trim();
        if (!content) {
            alert('排程內容不能為空！');
            return;
        }

        let newScheduleId = currentScheduleId;
        if (!newScheduleId) {
            newScheduleId = `schedule-${Date.now()}`;
            schedules[newScheduleId] = {
                id: newScheduleId,
                content: content,
                color: selectedColor,
                dayIndex: -1,
                startTime: '',
                todoStates: {}
            };
            alert('新排程已創建，請將其拖曳到時間表中的任一個格子，以指定時間和日期。');
        } else {
            if (schedules[newScheduleId]) {
                const oldSchedule = schedules[newScheduleId];
                schedules[newScheduleId].content = content;
                schedules[newScheduleId].color = selectedColor;
                if (oldSchedule.content !== content) {
                    schedules[newScheduleId].todoStates = {};
                }
            }
        }
        
        saveSchedules();
        renderSchedules();
        closeScheduleModal();
    }

    function copySchedule() {
        if (!currentScheduleId || !schedules[currentScheduleId]) {
            return;
        }

        const originalSchedule = schedules[currentScheduleId];
        const newId = `schedule-${Date.now()}`;
        
        schedules[newId] = {
            id: newId,
            content: originalSchedule.content,
            color: originalSchedule.color,
            dayIndex: -1,
            startTime: '',
            todoStates: JSON.parse(JSON.stringify(originalSchedule.todoStates || {}))
        };
        
        saveSchedules();
        renderSchedules();
        closeScheduleModal();
    }

    function deleteSchedule(id) {
        if (confirm('確定要刪除這個排程嗎？')) {
            delete schedules[id];
            saveSchedules();
            renderSchedules();
        }
    }

    addScheduleBtn.addEventListener('click', () => openScheduleModal());
    closeButton.addEventListener('click', closeScheduleModal);
    window.addEventListener('click', (event) => {
        if (event.target === scheduleModal) {
            closeScheduleModal();
        }
    });

    colorOptions.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('color-box')) {
            document.querySelectorAll('.color-box').forEach(box => box.classList.remove('active'));
            target.classList.add('active');
            selectedColor = target.dataset.color;
        }
    });

    saveScheduleBtn.addEventListener('click', saveOrUpdateSchedule);
    copyScheduleBtn.addEventListener('click', copySchedule);

    // --- 拖曳功能 ---
    let draggedItem = null;

    function handleDragStart(e) {
        draggedItem = e.target;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedItem.dataset.id);
        
        setTimeout(() => {
            draggedItem.classList.add('dragging');
        }, 0);
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetCell = e.target.closest('.schedule-cell');
        
        document.querySelectorAll('.schedule-cell.drag-over').forEach(cell => cell.classList.remove('drag-over'));
        document.querySelectorAll('.drag-preview').forEach(preview => preview.remove());

        if (targetCell && draggedItem) {
            targetCell.classList.add('drag-over');
            const preview = document.createElement('div');
            preview.classList.add('drag-preview');
            const scheduleContent = schedules[draggedItem.dataset.id]?.content || '';
            preview.textContent = scheduleContent.split('\n')[0].substring(0, 20) + (scheduleContent.length > 20 ? '...' : '');
            targetCell.appendChild(preview);
        }
    }

    function handleDragLeave(e) {
        const targetCell = e.target.closest('.schedule-cell');
        if (targetCell) {
            targetCell.classList.remove('drag-over');
            const preview = targetCell.querySelector('.drag-preview');
            if (preview) {
                preview.remove();
            }
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        const droppedOnCell = e.target.closest('.schedule-cell');
        
        document.querySelectorAll('.schedule-cell.drag-over').forEach(cell => cell.classList.remove('drag-over'));
        document.querySelectorAll('.drag-preview').forEach(preview => preview.remove());

        if (!droppedOnCell || !draggedItem) {
            if (draggedItem) {
                if (draggedItem.classList.contains('new-draggable') && document.body.contains(draggedItem)) {
                     document.body.removeChild(draggedItem);
                }
                 delete schedules[draggedItem.dataset.id];
                 saveSchedules();
                 renderSchedules();
            }
             draggedItem = null;
            return;
        }

        const id = e.dataTransfer.getData('text/plain');
        const itemData = schedules[id];

        if (!itemData) return;
        
        itemData.dayIndex = parseInt(droppedOnCell.dataset.dayIndex);
        itemData.startTime = droppedOnCell.dataset.time;

        schedules[id] = itemData;
        
        if (draggedItem.classList.contains('new-draggable')) {
            if (document.body.contains(draggedItem)) {
                document.body.removeChild(draggedItem);
            }
        }

        draggedItem.classList.remove('dragging');
        saveSchedules();
        renderSchedules();
        draggedItem = null;
    }

    // --- 數據匯出/匯入 ---
    exportDataBtn.addEventListener('click', () => {
        const dataStr = JSON.stringify(schedules, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `schedule_data_${formatDate(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('排程數據已匯出！');
    });

    importDataBtn.addEventListener('click', () => {
        importDataInput.click();
    });

    importDataInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedSchedules = JSON.parse(event.target.result);
                if (confirm('匯入數據將會覆蓋現有排程，確定要繼續嗎？')) {
                    schedules = importedSchedules;
                    saveSchedules();
                    renderSchedules();
                    alert('排程數據已成功匯入！');
                }
            } catch (error) {
                alert('匯入數據失敗：文件格式不正確或內容無效。');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    // --- 清空所有排程 ---
    clearAllSchedulesBtn.addEventListener('click', () => {
        if (confirm('確定要清空所有排程嗎？此操作不可復原！')) {
            schedules = {};
            localStorage.removeItem('schedules');
            history = [];
            historyIndex = -1;
            renderSchedules();
            updateUndoRedoButtons();
            alert('所有排程已清空。');
        }
    });

    // 初始化應用
    initGrid();
});