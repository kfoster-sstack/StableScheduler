/* ===================================================================
   StableScheduler — Dashboard Application Logic
   Refactored from main.js. All data operations are async via db.js.
   =================================================================== */

(function () {
    'use strict';

    // ---------------------------------------------------------------
    // CONFIG
    // ---------------------------------------------------------------
    var DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    var DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    var SHIFT_TEMPLATES = {
        'morning-feed': { start: '05:30', end: '07:00', role: 'feeding' },
        'am-barn': { start: '07:00', end: '12:00', role: 'mucking' },
        'pm-barn': { start: '12:00', end: '17:00', role: 'turnout' },
        'evening-feed': { start: '17:00', end: '18:30', role: 'feeding' }
    };

    var ROLES = {
        feeding: 'Feeding', mucking: 'Mucking', turnout: 'Turnout',
        lessons: 'Lessons', maintenance: 'Maintenance', office: 'Office'
    };

    var INST_COLORS = ['#3498db','#e74c3c','#2ecc71','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e'];

    // ---------------------------------------------------------------
    // STATE
    // ---------------------------------------------------------------
    var state = {
        profile: null,
        currentLessonWeek: getMonday(new Date()),
        currentStaffWeek: getMonday(new Date()),
        currentTaskDate: new Date(),
        lessonView: 'weekly',
        selectedDay: 0,
        activePage: 'overview',
        instructorColors: {},
        // Cached data for the current view
        cachedLessons: [],
        cachedShifts: [],
        cachedTasks: []
    };

    // ---------------------------------------------------------------
    // UTILITIES
    // ---------------------------------------------------------------
    function getMonday(d) {
        var date = new Date(d);
        var day = date.getDay();
        var diff = date.getDate() - day + (day === 0 ? -6 : 1);
        date.setDate(diff);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function addDays(d, n) {
        var date = new Date(d);
        date.setDate(date.getDate() + n);
        return date;
    }

    function formatDate(d) {
        var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatDateLong(d) {
        var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }

    function formatDateKey(d) {
        return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }

    function isToday(d) {
        var t = new Date();
        return d.getFullYear()===t.getFullYear() && d.getMonth()===t.getMonth() && d.getDate()===t.getDate();
    }

    function timeToSlot(timeStr) {
        var p = timeStr.split(':').map(Number);
        return (p[0] - 7) * 2 + (p[1] >= 30 ? 1 : 0);
    }

    function slotToTime(slot) {
        var h = Math.floor(slot / 2) + 7;
        var m = (slot % 2) * 30;
        return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
    }

    function formatTimeDisplay(timeStr) {
        var p = timeStr.split(':').map(Number);
        var ampm = p[0] >= 12 ? 'PM' : 'AM';
        var h12 = p[0] > 12 ? p[0]-12 : (p[0]===0 ? 12 : p[0]);
        return h12 + ':' + String(p[1]).padStart(2,'0') + ' ' + ampm;
    }

    function timeToMinutes(timeStr) {
        var p = timeStr.split(':').map(Number);
        return p[0] * 60 + p[1];
    }

    function getInstructorColorIndex(name) {
        if (!state.instructorColors[name]) {
            state.instructorColors[name] = Object.keys(state.instructorColors).length % 8;
        }
        return state.instructorColors[name];
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function getTodayDayIndex() {
        var d = new Date().getDay();
        return d === 0 ? 6 : d - 1; // Monday=0, Sunday=6
    }

    // ---------------------------------------------------------------
    // TOAST
    // ---------------------------------------------------------------
    function showToast(msg, type) {
        var toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.className = 'toast show' + (type ? ' ' + type : '');
        setTimeout(function () { toast.className = 'toast'; }, 3000);
    }

    // ---------------------------------------------------------------
    // NAVIGATION
    // ---------------------------------------------------------------
    function initNavigation() {
        // Sidebar nav
        document.querySelectorAll('.sidebar-nav a[data-page]').forEach(function (a) {
            a.addEventListener('click', function (e) {
                e.preventDefault();
                navigateTo(this.getAttribute('data-page'));
                closeMobileSidebar();
            });
        });

        // Mobile menu toggle
        var toggle = document.getElementById('menuToggle');
        var backdrop = document.getElementById('sidebarBackdrop');
        if (toggle) {
            toggle.addEventListener('click', function () {
                document.getElementById('sidebar').classList.toggle('open');
                backdrop.classList.toggle('open');
            });
        }
        if (backdrop) {
            backdrop.addEventListener('click', closeMobileSidebar);
        }

        // Hash routing
        window.addEventListener('hashchange', function () {
            var page = window.location.hash.slice(1) || 'overview';
            navigateTo(page);
        });

        // Initial route
        var initialPage = window.location.hash.slice(1) || 'overview';
        navigateTo(initialPage);
    }

    function navigateTo(pageName) {
        state.activePage = pageName;
        document.querySelectorAll('.sidebar-nav a[data-page]').forEach(function (a) {
            a.classList.toggle('active', a.getAttribute('data-page') === pageName);
        });
        document.querySelectorAll('.dash-page').forEach(function (p) {
            p.classList.toggle('active', p.id === 'page-' + pageName);
        });
        window.location.hash = pageName;

        // Load data for the page
        if (pageName === 'overview') renderOverview();
        else if (pageName === 'lessons') renderLessonGrid();
        else if (pageName === 'staff') renderStaffGrid();
        else if (pageName === 'tasks') renderTaskBoard();
        else if (pageName === 'settings') renderSettings();
    }

    function closeMobileSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarBackdrop').classList.remove('open');
    }

    // ---------------------------------------------------------------
    // MODALS
    // ---------------------------------------------------------------
    function initModals() {
        document.querySelectorAll('[data-close]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                closeModal(this.getAttribute('data-close'));
            });
        });
        document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) overlay.classList.remove('open');
            });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.open').forEach(function (m) {
                    m.classList.remove('open');
                });
            }
        });
    }

    function closeModal(id) {
        document.getElementById(id).classList.remove('open');
    }

    // ---------------------------------------------------------------
    // TIME SELECT
    // ---------------------------------------------------------------
    function populateTimeSelects() {
        var sel = document.getElementById('lessonTime');
        if (!sel) return;
        sel.innerHTML = '';
        for (var h = 7; h <= 20; h++) {
            for (var m = 0; m < 60; m += 30) {
                if (h === 20 && m > 0) break;
                var val = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
                var opt = document.createElement('option');
                opt.value = val;
                opt.textContent = formatTimeDisplay(val);
                sel.appendChild(opt);
            }
        }
    }

    // ---------------------------------------------------------------
    // OVERVIEW PAGE
    // ---------------------------------------------------------------
    async function renderOverview() {
        var today = new Date();
        var weekKey = formatDateKey(getMonday(today));
        var dateKey = formatDateKey(today);
        var dayIndex = getTodayDayIndex();

        document.getElementById('overviewDate').textContent = formatDateLong(today);

        try {
            var data = await DB.fetchTodayOverview(weekKey, dateKey, dayIndex);

            // Stats
            document.getElementById('statLessons').textContent = data.lessons.length;
            document.getElementById('statLessonsDetail').textContent = data.lessons.length === 0 ? 'No lessons today' : 'Next: ' + formatTimeDisplay(data.lessons[0].time);
            document.getElementById('statStaff').textContent = data.shifts.length;
            var staffNames = data.shifts.map(function(s){return s.staffName;}).filter(function(v,i,a){return a.indexOf(v)===i;});
            document.getElementById('statStaffDetail').textContent = staffNames.length === 0 ? 'No staff scheduled' : staffNames.slice(0,3).join(', ');
            document.getElementById('statTasks').textContent = data.tasksDone + '/' + data.tasksTotal;
            var pct = data.tasksTotal > 0 ? Math.round(data.tasksDone / data.tasksTotal * 100) : 0;
            document.getElementById('statTasksDetail').textContent = pct + '% complete';

            // Today's lessons
            var lessonsHtml = '';
            if (data.lessons.length === 0) {
                lessonsHtml = '<div class="overview-empty">No lessons scheduled for today.</div>';
            } else {
                data.lessons.forEach(function (l) {
                    var typeLabel = l.type === 'private' ? 'Private' : (l.type === 'semi-private' ? 'Semi-Private' : 'Group');
                    lessonsHtml += '<div class="overview-timeline-item">';
                    lessonsHtml += '<div class="overview-time">' + formatTimeDisplay(l.time) + '</div>';
                    lessonsHtml += '<div><div class="overview-event-title">' + escapeHtml(l.student) + ' — ' + typeLabel + '</div>';
                    lessonsHtml += '<div class="overview-event-detail">' + escapeHtml(l.horse) + ' &middot; ' + escapeHtml(l.instructor) + ' &middot; ' + l.duration + ' min</div></div>';
                    lessonsHtml += '</div>';
                });
            }
            document.getElementById('overviewLessons').innerHTML = lessonsHtml;

            // Today's staff
            var staffHtml = '';
            if (data.shifts.length === 0) {
                staffHtml = '<div class="overview-empty">No staff scheduled for today.</div>';
            } else {
                data.shifts.forEach(function (s) {
                    staffHtml += '<div class="overview-timeline-item">';
                    staffHtml += '<div class="overview-time">' + formatTimeDisplay(s.start) + '</div>';
                    staffHtml += '<div><div class="overview-event-title">' + escapeHtml(s.staffName) + '</div>';
                    staffHtml += '<div class="overview-event-detail">' + ROLES[s.role] + ' &middot; ' + formatTimeDisplay(s.start) + '-' + formatTimeDisplay(s.end) + '</div></div>';
                    staffHtml += '</div>';
                });
            }
            document.getElementById('overviewShifts').innerHTML = staffHtml;

        } catch (err) {
            showToast('Failed to load overview: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // LESSON SCHEDULE
    // ---------------------------------------------------------------
    function initLessonControls() {
        document.getElementById('btnAddLesson').addEventListener('click', function () { openLessonModal(); });
        document.getElementById('overviewAddLesson').addEventListener('click', function () {
            navigateTo('lessons');
            setTimeout(function(){ openLessonModal(); }, 100);
        });

        document.getElementById('viewWeekly').addEventListener('click', function () {
            state.lessonView = 'weekly';
            this.classList.add('active');
            document.getElementById('viewDaily').classList.remove('active');
            document.getElementById('daySelector').style.display = 'none';
            renderLessonGrid();
        });
        document.getElementById('viewDaily').addEventListener('click', function () {
            state.lessonView = 'daily';
            this.classList.add('active');
            document.getElementById('viewWeekly').classList.remove('active');
            document.getElementById('daySelector').style.display = '';
            renderLessonGrid();
        });

        document.getElementById('lessonPrevWeek').addEventListener('click', function () {
            state.currentLessonWeek = addDays(state.currentLessonWeek, -7);
            renderLessonGrid();
        });
        document.getElementById('lessonNextWeek').addEventListener('click', function () {
            state.currentLessonWeek = addDays(state.currentLessonWeek, 7);
            renderLessonGrid();
        });
        document.getElementById('lessonToday').addEventListener('click', function () {
            state.currentLessonWeek = getMonday(new Date());
            renderLessonGrid();
        });

        document.querySelectorAll('#daySelector .view-toggle button').forEach(function (btn) {
            btn.addEventListener('click', function () {
                document.querySelectorAll('#daySelector .view-toggle button').forEach(function (b) { b.classList.remove('active'); });
                this.classList.add('active');
                state.selectedDay = parseInt(this.getAttribute('data-day'));
                renderLessonGrid();
            });
        });

        document.getElementById('btnSaveLesson').addEventListener('click', saveLesson);
        document.getElementById('btnDeleteLesson').addEventListener('click', deleteLesson);
    }

    function openLessonModal(lesson) {
        var modal = document.getElementById('lessonModal');
        var title = document.getElementById('lessonModalTitle');
        var delBtn = document.getElementById('btnDeleteLesson');

        if (lesson) {
            title.textContent = 'Edit Lesson';
            delBtn.style.display = '';
            document.getElementById('lessonId').value = lesson.id;
            document.getElementById('lessonStudent').value = lesson.student;
            document.getElementById('lessonHorse').value = lesson.horse;
            document.getElementById('lessonInstructor').value = lesson.instructor;
            document.getElementById('lessonType').value = lesson.type;
            document.getElementById('lessonDuration').value = lesson.duration;
            document.getElementById('lessonDay').value = lesson.day;
            document.getElementById('lessonTime').value = lesson.time;
            document.getElementById('lessonRecurring').checked = lesson.recurring;
            document.getElementById('lessonNotes').value = lesson.notes || '';
        } else {
            title.textContent = 'Add Lesson';
            delBtn.style.display = 'none';
            document.getElementById('lessonForm').reset();
            document.getElementById('lessonId').value = '';
            document.getElementById('lessonDuration').value = '60';
        }
        modal.classList.add('open');
    }

    async function saveLesson() {
        var student = document.getElementById('lessonStudent').value.trim();
        var horse = document.getElementById('lessonHorse').value.trim();
        var instructor = document.getElementById('lessonInstructor').value.trim();

        if (!student || !horse || !instructor) {
            showToast('Please fill in all required fields.', 'error');
            return;
        }

        var lesson = {
            student: student, horse: horse, instructor: instructor,
            type: document.getElementById('lessonType').value,
            duration: parseInt(document.getElementById('lessonDuration').value),
            day: parseInt(document.getElementById('lessonDay').value),
            time: document.getElementById('lessonTime').value,
            recurring: document.getElementById('lessonRecurring').checked,
            notes: document.getElementById('lessonNotes').value.trim(),
            weekKey: formatDateKey(state.currentLessonWeek)
        };

        var existingId = document.getElementById('lessonId').value;

        // Conflict detection (client-side against cached lessons)
        var conflicts = detectLessonConflicts(lesson, existingId);
        if (conflicts.length > 0) {
            if (!confirm('Scheduling conflict detected:\n' + conflicts.join('\n') + '\n\nSave anyway?')) return;
        }

        try {
            if (existingId) {
                await DB.updateLesson(existingId, lesson);
                showToast('Lesson updated.', 'success');
            } else {
                await DB.insertLesson(lesson);
                showToast('Lesson added.', 'success');
            }
            closeModal('lessonModal');
            await renderLessonGrid();
        } catch (err) {
            showToast('Error saving lesson: ' + err.message, 'error');
        }
    }

    async function deleteLesson() {
        var id = document.getElementById('lessonId').value;
        if (!id || !confirm('Delete this lesson?')) return;

        try {
            await DB.deleteLesson(id);
            closeModal('lessonModal');
            await renderLessonGrid();
            showToast('Lesson deleted.', 'success');
        } catch (err) {
            showToast('Error deleting lesson: ' + err.message, 'error');
        }
    }

    function detectLessonConflicts(lesson, excludeId) {
        var conflicts = [];
        var startMin = timeToMinutes(lesson.time);
        var endMin = startMin + lesson.duration;

        state.cachedLessons.forEach(function (existing) {
            if (existing.id === excludeId) return;
            if (existing.day !== lesson.day) return;
            if (!lesson.recurring && !existing.recurring && existing.weekKey !== lesson.weekKey) return;

            var exStart = timeToMinutes(existing.time);
            var exEnd = exStart + existing.duration;

            if (startMin < exEnd && endMin > exStart) {
                if (existing.horse.toLowerCase() === lesson.horse.toLowerCase()) {
                    conflicts.push('Horse "' + lesson.horse + '" is already booked at ' + formatTimeDisplay(existing.time) + ' with ' + existing.student);
                }
                if (existing.instructor.toLowerCase() === lesson.instructor.toLowerCase() && existing.type === 'private' && lesson.type === 'private') {
                    conflicts.push('Instructor "' + lesson.instructor + '" already has a private lesson at ' + formatTimeDisplay(existing.time));
                }
            }
        });
        return conflicts;
    }

    async function renderLessonGrid() {
        var grid = document.getElementById('lessonGrid');
        var weekLabel = document.getElementById('lessonWeekLabel');
        weekLabel.textContent = 'Week of ' + formatDate(state.currentLessonWeek);

        grid.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

        try {
            var weekKey = formatDateKey(state.currentLessonWeek);
            var lessons = await DB.fetchLessonsForWeek(weekKey);
            state.cachedLessons = lessons;

            var html = '';

            if (state.lessonView === 'weekly') {
                grid.className = 'schedule-grid weekly';
                html += '<div class="grid-header"></div>';
                for (var d = 0; d < 7; d++) {
                    var dayDate = addDays(state.currentLessonWeek, d);
                    var todayStyle = isToday(dayDate) ? ' style="background:#C41E3A;"' : '';
                    html += '<div class="grid-header"' + todayStyle + '>' + DAYS_SHORT[d] + '<br>' + (dayDate.getMonth()+1) + '/' + dayDate.getDate() + '</div>';
                }

                for (var slot = 0; slot < 26; slot++) {
                    var timeStr = slotToTime(slot);
                    html += '<div class="grid-time">' + formatTimeDisplay(timeStr) + '</div>';
                    for (var day = 0; day < 7; day++) {
                        var cellLessons = lessons.filter(function (l) {
                            if (l.day !== day) return false;
                            var lSlot = timeToSlot(l.time);
                            return slot >= lSlot && slot < lSlot + Math.ceil(l.duration / 30);
                        });
                        html += '<div class="grid-cell" data-day="' + day + '" data-slot="' + slot + '">';
                        cellLessons.forEach(function (l) {
                            if (slot === timeToSlot(l.time)) {
                                var ci = getInstructorColorIndex(l.instructor);
                                var tl = l.type==='private'?'Priv':(l.type==='semi-private'?'Semi':'Group');
                                html += '<div class="lesson-block inst-color-' + ci + '" data-id="' + l.id + '">';
                                html += '<div class="block-title">' + escapeHtml(l.student) + '</div>';
                                html += '<div class="block-detail">' + escapeHtml(l.horse) + ' &middot; ' + tl + ' &middot; ' + l.duration + 'min</div>';
                                html += '</div>';
                            }
                        });
                        html += '</div>';
                    }
                }
            } else {
                grid.className = 'schedule-grid daily';
                var dayDate = addDays(state.currentLessonWeek, state.selectedDay);
                html += '<div class="grid-header"></div>';
                html += '<div class="grid-header">' + DAYS[state.selectedDay] + ' ' + (dayDate.getMonth()+1) + '/' + dayDate.getDate() + '</div>';

                for (var slot = 0; slot < 26; slot++) {
                    var timeStr = slotToTime(slot);
                    html += '<div class="grid-time">' + formatTimeDisplay(timeStr) + '</div>';
                    var cellLessons = lessons.filter(function (l) {
                        if (l.day !== state.selectedDay) return false;
                        var lSlot = timeToSlot(l.time);
                        return slot >= lSlot && slot < lSlot + Math.ceil(l.duration / 30);
                    });
                    html += '<div class="grid-cell" data-day="' + state.selectedDay + '" data-slot="' + slot + '">';
                    cellLessons.forEach(function (l) {
                        if (slot === timeToSlot(l.time)) {
                            var ci = getInstructorColorIndex(l.instructor);
                            var tl = l.type==='private'?'Private':(l.type==='semi-private'?'Semi-Private':'Group');
                            html += '<div class="lesson-block inst-color-' + ci + '" data-id="' + l.id + '">';
                            html += '<div class="block-title">' + escapeHtml(l.student) + '</div>';
                            html += '<div class="block-detail">' + escapeHtml(l.horse) + ' &middot; ' + escapeHtml(l.instructor) + '</div>';
                            html += '<div class="block-detail">' + tl + ' &middot; ' + l.duration + ' min &middot; ' + formatTimeDisplay(l.time) + '</div>';
                            if (l.notes) html += '<div class="block-detail" style="font-style:italic;">' + escapeHtml(l.notes) + '</div>';
                            html += '</div>';
                        }
                    });
                    html += '</div>';
                }
            }

            grid.innerHTML = html;

            // Click handlers
            grid.querySelectorAll('.lesson-block').forEach(function (block) {
                block.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var lesson = state.cachedLessons.find(function (l) { return l.id === block.getAttribute('data-id'); });
                    if (lesson) openLessonModal(lesson);
                });
            });
            grid.querySelectorAll('.grid-cell').forEach(function (cell) {
                cell.addEventListener('click', function () {
                    document.getElementById('lessonDay').value = this.getAttribute('data-day');
                    document.getElementById('lessonTime').value = slotToTime(parseInt(this.getAttribute('data-slot')));
                    openLessonModal();
                });
            });

        } catch (err) {
            grid.innerHTML = '<div class="loading-state">Failed to load lessons.</div>';
            showToast('Error loading lessons: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // STAFF SCHEDULE
    // ---------------------------------------------------------------
    function initStaffControls() {
        document.getElementById('btnAddShift').addEventListener('click', function () { openShiftModal(); });
        document.getElementById('overviewAddShift').addEventListener('click', function () {
            navigateTo('staff');
            setTimeout(function(){ openShiftModal(); }, 100);
        });

        document.getElementById('staffPrevWeek').addEventListener('click', function () {
            state.currentStaffWeek = addDays(state.currentStaffWeek, -7);
            renderStaffGrid();
        });
        document.getElementById('staffNextWeek').addEventListener('click', function () {
            state.currentStaffWeek = addDays(state.currentStaffWeek, 7);
            renderStaffGrid();
        });
        document.getElementById('staffToday').addEventListener('click', function () {
            state.currentStaffWeek = getMonday(new Date());
            renderStaffGrid();
        });

        document.querySelectorAll('.template-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tpl = SHIFT_TEMPLATES[this.getAttribute('data-template')];
                if (tpl) {
                    document.getElementById('shiftStart').value = tpl.start;
                    document.getElementById('shiftEnd').value = tpl.end;
                    document.getElementById('shiftRole').value = tpl.role;
                    openShiftModal(null, tpl);
                }
            });
        });

        document.getElementById('btnSaveShift').addEventListener('click', saveShift);
        document.getElementById('btnDeleteShift').addEventListener('click', deleteShift);
    }

    function openShiftModal(shift, template) {
        var modal = document.getElementById('shiftModal');
        var title = document.getElementById('shiftModalTitle');
        var delBtn = document.getElementById('btnDeleteShift');

        if (shift) {
            title.textContent = 'Edit Shift';
            delBtn.style.display = '';
            document.getElementById('shiftId').value = shift.id;
            document.getElementById('shiftStaff').value = shift.staffName;
            document.getElementById('shiftDay').value = shift.day;
            document.getElementById('shiftRole').value = shift.role;
            document.getElementById('shiftStart').value = shift.start;
            document.getElementById('shiftEnd').value = shift.end;
        } else {
            title.textContent = 'Add Shift';
            delBtn.style.display = 'none';
            document.getElementById('shiftForm').reset();
            document.getElementById('shiftId').value = '';
            if (template) {
                document.getElementById('shiftStart').value = template.start;
                document.getElementById('shiftEnd').value = template.end;
                document.getElementById('shiftRole').value = template.role;
            } else {
                document.getElementById('shiftStart').value = '07:00';
                document.getElementById('shiftEnd').value = '12:00';
            }
        }
        modal.classList.add('open');
    }

    async function saveShift() {
        var staffName = document.getElementById('shiftStaff').value.trim();
        if (!staffName) { showToast('Please enter a staff member name.', 'error'); return; }

        var start = document.getElementById('shiftStart').value;
        var end = document.getElementById('shiftEnd').value;
        if (timeToMinutes(end) <= timeToMinutes(start)) {
            showToast('End time must be after start time.', 'error'); return;
        }

        var shift = {
            staffName: staffName,
            day: parseInt(document.getElementById('shiftDay').value),
            role: document.getElementById('shiftRole').value,
            start: start, end: end,
            weekKey: formatDateKey(state.currentStaffWeek)
        };

        var existingId = document.getElementById('shiftId').value;

        try {
            if (existingId) {
                await DB.updateShift(existingId, shift);
                showToast('Shift updated.', 'success');
            } else {
                await DB.insertShift(shift);
                showToast('Shift added.', 'success');
            }
            closeModal('shiftModal');
            await renderStaffGrid();
        } catch (err) {
            showToast('Error saving shift: ' + err.message, 'error');
        }
    }

    async function deleteShift() {
        var id = document.getElementById('shiftId').value;
        if (!id || !confirm('Delete this shift?')) return;

        try {
            await DB.deleteShift(id);
            closeModal('shiftModal');
            await renderStaffGrid();
            showToast('Shift deleted.', 'success');
        } catch (err) {
            showToast('Error deleting shift: ' + err.message, 'error');
        }
    }

    async function renderStaffGrid() {
        var grid = document.getElementById('staffGrid');
        var weekLabel = document.getElementById('staffWeekLabel');
        weekLabel.textContent = 'Week of ' + formatDate(state.currentStaffWeek);

        grid.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

        try {
            var weekKey = formatDateKey(state.currentStaffWeek);
            var shifts = await DB.fetchShiftsForWeek(weekKey);
            state.cachedShifts = shifts;

            grid.className = 'schedule-grid weekly';
            var html = '<div class="grid-header">Time</div>';
            for (var d = 0; d < 7; d++) {
                var dayDate = addDays(state.currentStaffWeek, d);
                var todayStyle = isToday(dayDate) ? ' style="background:#C41E3A;"' : '';
                html += '<div class="grid-header"' + todayStyle + '>' + DAYS_SHORT[d] + '<br>' + (dayDate.getMonth()+1) + '/' + dayDate.getDate() + '</div>';
            }

            for (var h = 5; h <= 19; h++) {
                var timeStr = String(h).padStart(2,'0') + ':00';
                html += '<div class="grid-time">' + formatTimeDisplay(timeStr) + '</div>';
                for (var day = 0; day < 7; day++) {
                    var hourStart = h * 60, hourEnd = (h+1) * 60;
                    var cellShifts = shifts.filter(function (s) {
                        if (s.day !== day) return false;
                        return timeToMinutes(s.start) < hourEnd && timeToMinutes(s.end) > hourStart;
                    });
                    html += '<div class="grid-cell" data-day="' + day + '" data-hour="' + h + '">';
                    cellShifts.forEach(function (s) {
                        var sStart = timeToMinutes(s.start);
                        if (Math.floor(sStart / 60) === h || (sStart < h * 60 && h === 5)) {
                            html += '<div class="shift-block role-' + s.role + '" data-id="' + s.id + '">';
                            html += '<div class="block-title">' + escapeHtml(s.staffName) + '</div>';
                            html += '<div class="block-detail">' + ROLES[s.role] + ' ' + formatTimeDisplay(s.start) + '-' + formatTimeDisplay(s.end) + '</div>';
                            html += '</div>';
                        }
                    });
                    html += '</div>';
                }
            }

            grid.innerHTML = html;

            grid.querySelectorAll('.shift-block').forEach(function (block) {
                block.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var shift = state.cachedShifts.find(function (s) { return s.id === block.getAttribute('data-id'); });
                    if (shift) openShiftModal(shift);
                });
            });
            grid.querySelectorAll('.grid-cell').forEach(function (cell) {
                cell.addEventListener('click', function () {
                    var day = parseInt(this.getAttribute('data-day'));
                    var hour = parseInt(this.getAttribute('data-hour'));
                    document.getElementById('shiftDay').value = day;
                    document.getElementById('shiftStart').value = String(hour).padStart(2,'0') + ':00';
                    document.getElementById('shiftEnd').value = String(Math.min(hour+5, 19)).padStart(2,'0') + ':00';
                    openShiftModal();
                });
            });

            renderStaffSummary(shifts);

        } catch (err) {
            grid.innerHTML = '<div class="loading-state">Failed to load shifts.</div>';
            showToast('Error loading shifts: ' + err.message, 'error');
        }
    }

    function renderStaffSummary(shifts) {
        var tbody = document.getElementById('staffSummaryBody');
        var staffMap = {};
        shifts.forEach(function (s) {
            if (!staffMap[s.staffName]) staffMap[s.staffName] = { name: s.staffName, days: [0,0,0,0,0,0,0], total: 0 };
            var hours = (timeToMinutes(s.end) - timeToMinutes(s.start)) / 60;
            staffMap[s.staffName].days[s.day] += hours;
            staffMap[s.staffName].total += hours;
        });

        var html = '';
        var names = Object.keys(staffMap).sort();
        if (names.length === 0) {
            html = '<tr><td colspan="9" style="text-align:center;color:var(--text-light);padding:20px;">No shifts scheduled this week.</td></tr>';
        } else {
            names.forEach(function (name) {
                var d = staffMap[name];
                html += '<tr><td><strong>' + escapeHtml(d.name) + '</strong></td>';
                for (var i = 0; i < 7; i++) html += '<td>' + (d.days[i] > 0 ? d.days[i].toFixed(1) + 'h' : '-') + '</td>';
                html += '<td><span class="hours-badge">' + d.total.toFixed(1) + 'h</span></td></tr>';
            });
        }
        tbody.innerHTML = html;
    }

    // ---------------------------------------------------------------
    // TASK BOARD
    // ---------------------------------------------------------------
    function initTaskControls() {
        document.getElementById('btnAddTask').addEventListener('click', addCustomTask);
        document.getElementById('newTaskInput').addEventListener('keypress', function (e) {
            if (e.key === 'Enter') addCustomTask();
        });

        document.getElementById('btnResetTasks').addEventListener('click', async function () {
            if (!confirm('Reset all tasks for this day?')) return;
            try {
                await DB.deleteTasksForDate(formatDateKey(state.currentTaskDate));
                await renderTaskBoard();
                showToast('Tasks reset.', 'success');
            } catch (err) {
                showToast('Error resetting tasks: ' + err.message, 'error');
            }
        });

        document.getElementById('taskPrevDay').addEventListener('click', function () {
            state.currentTaskDate = addDays(state.currentTaskDate, -1);
            renderTaskBoard();
        });
        document.getElementById('taskNextDay').addEventListener('click', function () {
            state.currentTaskDate = addDays(state.currentTaskDate, 1);
            renderTaskBoard();
        });
        document.getElementById('taskTodayBtn').addEventListener('click', function () {
            state.currentTaskDate = new Date();
            renderTaskBoard();
        });
    }

    async function addCustomTask() {
        var input = document.getElementById('newTaskInput');
        var name = input.value.trim();
        if (!name) return;

        try {
            var tasks = state.cachedTasks;
            await DB.insertTask(formatDateKey(state.currentTaskDate), name, tasks.length);
            input.value = '';
            await renderTaskBoard();
            showToast('Task added.', 'success');
        } catch (err) {
            showToast('Error adding task: ' + err.message, 'error');
        }
    }

    async function renderTaskBoard() {
        var list = document.getElementById('taskList');
        var dateLabel = document.getElementById('taskDateLabel');
        var boardDate = document.getElementById('taskBoardDate');

        var todayStr = isToday(state.currentTaskDate) ? 'Today - ' : '';
        dateLabel.textContent = todayStr + formatDateLong(state.currentTaskDate);
        boardDate.textContent = formatDateLong(state.currentTaskDate);

        list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';

        try {
            var dateKey = formatDateKey(state.currentTaskDate);
            var tasks = await DB.fetchTasksForDate(dateKey);
            state.cachedTasks = tasks;

            var html = '';
            tasks.forEach(function (task) {
                var cc = task.completed ? ' completed' : '';
                html += '<li class="task-item' + cc + '" data-id="' + task.id + '">';
                html += '<div class="task-checkbox" data-id="' + task.id + '"></div>';
                html += '<span class="task-name">' + escapeHtml(task.name) + '</span>';
                if (task.timestamp) html += '<span class="task-timestamp">Completed ' + task.timestamp + '</span>';
                html += '<button class="task-delete" data-id="' + task.id + '" title="Delete task">&times;</button>';
                html += '</li>';
            });
            list.innerHTML = html;

            // Progress
            var completed = tasks.filter(function (t) { return t.completed; }).length;
            var total = tasks.length;
            var pct = total > 0 ? Math.round(completed / total * 100) : 0;
            document.getElementById('progressText').textContent = completed + ' of ' + total + ' tasks complete (' + pct + '%)';
            document.getElementById('progressFill').style.width = pct + '%';

            // Event handlers
            list.querySelectorAll('.task-checkbox').forEach(function (cb) {
                cb.addEventListener('click', async function () {
                    var id = this.getAttribute('data-id');
                    var task = state.cachedTasks.find(function (t) { return t.id === id; });
                    if (task) {
                        try {
                            await DB.toggleTask(id, !task.completed);
                            await renderTaskBoard();
                        } catch (err) {
                            showToast('Error updating task: ' + err.message, 'error');
                        }
                    }
                });
            });

            list.querySelectorAll('.task-delete').forEach(function (btn) {
                btn.addEventListener('click', async function () {
                    try {
                        await DB.deleteTask(this.getAttribute('data-id'));
                        await renderTaskBoard();
                    } catch (err) {
                        showToast('Error deleting task: ' + err.message, 'error');
                    }
                });
            });

        } catch (err) {
            list.innerHTML = '<div class="loading-state">Failed to load tasks.</div>';
            showToast('Error loading tasks: ' + err.message, 'error');
        }
    }

    // ---------------------------------------------------------------
    // SETTINGS PAGE
    // ---------------------------------------------------------------
    function initSettingsControls() {
        document.getElementById('saveBarnName').addEventListener('click', async function () {
            var name = document.getElementById('settingsBarnName').value.trim();
            if (!name) return;
            try {
                await DB.updateProfile({ barnName: name });
                state.profile.barnName = name;
                document.getElementById('barnNameDisplay').textContent = name;
                showToast('Barn name saved.', 'success');
            } catch (err) {
                showToast('Error saving: ' + err.message, 'error');
            }
        });

        // Instructors
        document.getElementById('addInstructorBtn').addEventListener('click', async function () {
            var input = document.getElementById('newInstructorInput');
            var name = input.value.trim();
            if (!name) return;
            try {
                var instructors = await DB.fetchInstructors();
                await DB.addInstructor(name, instructors.length % 8);
                input.value = '';
                await renderInstructorList();
                showToast('Instructor added.', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); }
        });

        // Horses
        document.getElementById('addHorseBtn').addEventListener('click', async function () {
            var input = document.getElementById('newHorseInput');
            var name = input.value.trim();
            if (!name) return;
            try {
                await DB.addHorse(name);
                input.value = '';
                await renderHorseList();
                showToast('Horse added.', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); }
        });

        // Staff Members
        document.getElementById('addStaffMemberBtn').addEventListener('click', async function () {
            var input = document.getElementById('newStaffMemberInput');
            var name = input.value.trim();
            if (!name) return;
            try {
                await DB.addStaffMember(name);
                input.value = '';
                await renderStaffMemberList();
                showToast('Staff member added.', 'success');
            } catch (err) { showToast('Error: ' + err.message, 'error'); }
        });

        // Import
        document.getElementById('importBtn').addEventListener('click', async function () {
            if (!confirm('Import data from this browser\'s local storage? This will add to (not replace) your existing data.')) return;
            try {
                var result = await DB.importFromLocalStorage();
                showToast('Imported ' + result.lessons + ' lessons, ' + result.shifts + ' shifts, ' + result.tasks + ' tasks.', 'success');
            } catch (err) {
                showToast('Import failed: ' + err.message, 'error');
            }
        });

        // Print & Export
        document.getElementById('btnPrint').addEventListener('click', printSchedule);
        document.getElementById('btnExport').addEventListener('click', exportSchedule);

        // Delete account
        document.getElementById('deleteAccountBtn').addEventListener('click', async function () {
            if (!confirm('Are you sure you want to delete your account? All data will be permanently lost.')) return;
            if (!confirm('This CANNOT be undone. Type "delete" in the next prompt to confirm.')) return;
            var typed = prompt('Type "delete" to confirm:');
            if (typed !== 'delete') { showToast('Account deletion cancelled.', 'error'); return; }

            try {
                // Delete all user data (cascading from profiles)
                await supabase.from('profiles').delete().eq('id', DB.getUserId());
                await supabase.auth.signOut();
                window.location.href = 'index.html';
            } catch (err) {
                showToast('Error deleting account: ' + err.message, 'error');
            }
        });
    }

    async function renderSettings() {
        if (state.profile) {
            document.getElementById('settingsBarnName').value = state.profile.barnName || '';
            document.getElementById('settingsEmail').textContent = state.profile.email || '';
        }
        await Promise.all([renderInstructorList(), renderHorseList(), renderStaffMemberList()]);
    }

    async function renderInstructorList() {
        var list = document.getElementById('instructorList');
        try {
            var instructors = await DB.fetchInstructors();
            if (instructors.length === 0) {
                list.innerHTML = '<li class="managed-list-item"><span class="item-name" style="color:var(--text-light);">No instructors added yet.</span></li>';
                return;
            }
            list.innerHTML = instructors.map(function (inst) {
                return '<li class="managed-list-item">' +
                    '<span class="color-dot" style="background:' + INST_COLORS[inst.colorIndex % 8] + ';"></span>' +
                    '<span class="item-name">' + escapeHtml(inst.name) + '</span>' +
                    '<button class="remove-btn" data-id="' + inst.id + '" data-type="instructor">&times;</button></li>';
            }).join('');
            attachRemoveHandlers(list, 'instructor');
        } catch (err) { list.innerHTML = '<li class="managed-list-item"><span class="item-name" style="color:var(--red);">Error loading.</span></li>'; }
    }

    async function renderHorseList() {
        var list = document.getElementById('horseList');
        try {
            var horses = await DB.fetchHorses();
            if (horses.length === 0) {
                list.innerHTML = '<li class="managed-list-item"><span class="item-name" style="color:var(--text-light);">No horses added yet.</span></li>';
                return;
            }
            list.innerHTML = horses.map(function (h) {
                return '<li class="managed-list-item"><span class="item-name">' + escapeHtml(h.name) + '</span>' +
                    '<button class="remove-btn" data-id="' + h.id + '" data-type="horse">&times;</button></li>';
            }).join('');
            attachRemoveHandlers(list, 'horse');
        } catch (err) { list.innerHTML = '<li class="managed-list-item"><span class="item-name" style="color:var(--red);">Error loading.</span></li>'; }
    }

    async function renderStaffMemberList() {
        var list = document.getElementById('staffMemberList');
        try {
            var members = await DB.fetchStaffMembers();
            if (members.length === 0) {
                list.innerHTML = '<li class="managed-list-item"><span class="item-name" style="color:var(--text-light);">No staff members added yet.</span></li>';
                return;
            }
            list.innerHTML = members.map(function (m) {
                return '<li class="managed-list-item"><span class="item-name">' + escapeHtml(m.name) + '</span>' +
                    '<button class="remove-btn" data-id="' + m.id + '" data-type="staffMember">&times;</button></li>';
            }).join('');
            attachRemoveHandlers(list, 'staffMember');
        } catch (err) { list.innerHTML = '<li class="managed-list-item"><span class="item-name" style="color:var(--red);">Error loading.</span></li>'; }
    }

    function attachRemoveHandlers(list, type) {
        list.querySelectorAll('.remove-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = this.getAttribute('data-id');
                if (!confirm('Remove this item?')) return;
                try {
                    if (type === 'instructor') { await DB.removeInstructor(id); await renderInstructorList(); }
                    else if (type === 'horse') { await DB.removeHorse(id); await renderHorseList(); }
                    else if (type === 'staffMember') { await DB.removeStaffMember(id); await renderStaffMemberList(); }
                    showToast('Removed.', 'success');
                } catch (err) { showToast('Error: ' + err.message, 'error'); }
            });
        });
    }

    // ---------------------------------------------------------------
    // PRINT / EXPORT
    // ---------------------------------------------------------------
    async function buildPrintHTML() {
        var weekKey = formatDateKey(state.currentLessonWeek);
        var lessons = await DB.fetchLessonsForWeek(weekKey);
        var shifts = await DB.fetchShiftsForWeek(formatDateKey(state.currentStaffWeek));
        var tasks = await DB.fetchTasksForDate(formatDateKey(new Date()));

        var barnName = state.profile ? state.profile.barnName : 'StableScheduler';

        var html = '<div class="print-header">';
        html += '<h1>' + escapeHtml(barnName) + ' — Weekly Schedule</h1>';
        html += '<p>Week of ' + formatDate(state.currentLessonWeek) + ' &bull; Powered by StableScheduler | sstack.com</p></div>';

        if (lessons.length > 0) {
            html += '<h2 style="font-size:1.1rem;margin:16px 0 8px;">Lesson Schedule</h2>';
            html += '<table class="print-table"><thead><tr><th>Day</th><th>Time</th><th>Student</th><th>Horse</th><th>Instructor</th><th>Type</th><th>Duration</th></tr></thead><tbody>';
            lessons.sort(function (a, b) { return a.day - b.day || a.time.localeCompare(b.time); });
            lessons.forEach(function (l) {
                var tl = l.type==='private'?'Private':(l.type==='semi-private'?'Semi-Private':'Group');
                html += '<tr><td>'+DAYS[l.day]+'</td><td>'+formatTimeDisplay(l.time)+'</td><td>'+escapeHtml(l.student)+'</td><td>'+escapeHtml(l.horse)+'</td><td>'+escapeHtml(l.instructor)+'</td><td>'+tl+'</td><td>'+l.duration+' min</td></tr>';
            });
            html += '</tbody></table>';
        }

        if (shifts.length > 0) {
            html += '<h2 style="font-size:1.1rem;margin:16px 0 8px;">Staff Schedule</h2>';
            html += '<table class="print-table"><thead><tr><th>Day</th><th>Staff</th><th>Role</th><th>Start</th><th>End</th><th>Hours</th></tr></thead><tbody>';
            shifts.sort(function (a, b) { return a.day - b.day || a.start.localeCompare(b.start); });
            shifts.forEach(function (s) {
                var hours = ((timeToMinutes(s.end) - timeToMinutes(s.start)) / 60).toFixed(1);
                html += '<tr><td>'+DAYS[s.day]+'</td><td>'+escapeHtml(s.staffName)+'</td><td>'+ROLES[s.role]+'</td><td>'+formatTimeDisplay(s.start)+'</td><td>'+formatTimeDisplay(s.end)+'</td><td>'+hours+'h</td></tr>';
            });
            html += '</tbody></table>';
        }

        html += '<h2 style="font-size:1.1rem;margin:16px 0 8px;">Today\'s Tasks — ' + formatDate(new Date()) + '</h2>';
        html += '<table class="print-table"><thead><tr><th>Task</th><th>Status</th><th>Completed At</th></tr></thead><tbody>';
        tasks.forEach(function (t) {
            html += '<tr><td>'+escapeHtml(t.name)+'</td><td>'+(t.completed?'Done':'Pending')+'</td><td>'+(t.timestamp||'-')+'</td></tr>';
        });
        html += '</tbody></table>';

        html += '<div class="print-footer">StableScheduler.com &bull; Powered by Schneider Saddlery | sstack.com &bull; Horses Define Who We Are&trade;</div>';
        return html;
    }

    async function printSchedule() {
        try {
            var container = document.getElementById('printContainer');
            container.innerHTML = await buildPrintHTML();
            window.print();
            setTimeout(function () { container.innerHTML = ''; }, 1000);
        } catch (err) { showToast('Print failed: ' + err.message, 'error'); }
    }

    async function exportSchedule() {
        try {
            var content = await buildPrintHTML();
            var fullHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>StableScheduler Export</title><style>';
            fullHTML += 'body{font-family:-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,sans-serif;padding:24px;color:#333;}';
            fullHTML += 'h1{font-size:1.5rem;color:#1B2A4A;} h2{font-size:1.1rem;color:#1B2A4A;margin:20px 0 8px;}';
            fullHTML += '.print-header{text-align:center;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #1B2A4A;} .print-header p{color:#666;font-size:0.9rem;}';
            fullHTML += '.print-table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:0.85rem;}';
            fullHTML += '.print-table th,.print-table td{border:1px solid #ddd;padding:8px 10px;text-align:left;}';
            fullHTML += '.print-table th{background:#f5f5f5;font-weight:600;color:#1B2A4A;}';
            fullHTML += '.print-footer{text-align:center;font-size:0.8rem;color:#999;margin-top:24px;padding-top:12px;border-top:1px solid #ddd;}';
            fullHTML += '</style></head><body>' + content + '</body></html>';

            var blob = new Blob([fullHTML], { type: 'text/html' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'StableScheduler-Week-' + formatDateKey(state.currentLessonWeek) + '.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('Schedule exported.', 'success');
        } catch (err) { showToast('Export failed: ' + err.message, 'error'); }
    }

    // ---------------------------------------------------------------
    // INIT
    // ---------------------------------------------------------------
    async function init() {
        try {
            await DB.init();
            state.profile = await DB.getProfile();

            // Display barn name
            document.getElementById('barnNameDisplay').textContent = state.profile.barnName || 'My Barn';

            // Hide loading
            document.getElementById('pageLoading').classList.add('hidden');

            // Init all controls
            populateTimeSelects();
            initNavigation();
            initModals();
            initLessonControls();
            initStaffControls();
            initTaskControls();
            initSettingsControls();

        } catch (err) {
            console.error('Dashboard init failed:', err);
            // If auth error, redirect
            if (err.message === 'Not authenticated') {
                window.location.href = 'login.html';
            } else {
                document.getElementById('pageLoading').innerHTML =
                    '<p style="color:var(--red);">Failed to load dashboard. Please refresh or try again.</p>';
            }
        }
    }

    // Run
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
