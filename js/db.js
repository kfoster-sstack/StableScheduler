/* ===================================================================
   StableScheduler — Data Layer (Supabase CRUD)
   Replaces localStorage with async Supabase queries.
   Maps PostgreSQL snake_case to JavaScript camelCase.
   =================================================================== */

var DB = (function () {
    'use strict';

    var userId = null;

    var DEFAULT_TASKS = [
        'AM Feed', 'Check Water', 'Turnout', 'Muck Stalls',
        'Sweep Aisle', 'PM Feed', 'Evening Check', 'Hay Restock'
    ];

    // ---------------------------------------------------------------
    // INIT
    // ---------------------------------------------------------------
    async function init() {
        var result = await supabase.auth.getSession();
        if (!result.data.session) throw new Error('Not authenticated');
        userId = result.data.session.user.id;
        return userId;
    }

    function getUserId() { return userId; }

    // ---------------------------------------------------------------
    // PROFILE
    // ---------------------------------------------------------------
    async function getProfile() {
        var r = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (r.error) throw r.error;
        return { id: r.data.id, email: r.data.email, barnName: r.data.barn_name, createdAt: r.data.created_at };
    }

    async function updateProfile(updates) {
        var db = { updated_at: new Date().toISOString() };
        if (updates.barnName !== undefined) db.barn_name = updates.barnName;
        var r = await supabase.from('profiles').update(db).eq('id', userId);
        if (r.error) throw r.error;
    }

    // ---------------------------------------------------------------
    // LESSONS
    // ---------------------------------------------------------------
    function mapLessonFrom(row) {
        return {
            id: row.id, student: row.student, horse: row.horse,
            instructor: row.instructor, type: row.type, duration: row.duration,
            day: row.day, time: row.time, recurring: row.recurring,
            notes: row.notes || '', weekKey: row.week_key
        };
    }

    function mapLessonTo(l) {
        return {
            user_id: userId, student: l.student, horse: l.horse,
            instructor: l.instructor, type: l.type, duration: l.duration,
            day: l.day, time: l.time, recurring: l.recurring || false,
            notes: l.notes || '', week_key: l.weekKey
        };
    }

    async function fetchLessonsForWeek(weekKey) {
        var r = await supabase.from('lessons').select('*').eq('user_id', userId)
            .or('week_key.eq.' + weekKey + ',recurring.eq.true');
        if (r.error) throw r.error;
        return (r.data || []).map(mapLessonFrom);
    }

    async function insertLesson(lesson) {
        var r = await supabase.from('lessons').insert(mapLessonTo(lesson)).select().single();
        if (r.error) throw r.error;
        return mapLessonFrom(r.data);
    }

    async function updateLesson(id, lesson) {
        var db = mapLessonTo(lesson);
        delete db.user_id;
        db.updated_at = new Date().toISOString();
        var r = await supabase.from('lessons').update(db).eq('id', id).eq('user_id', userId);
        if (r.error) throw r.error;
    }

    async function deleteLesson(id) {
        var r = await supabase.from('lessons').delete().eq('id', id).eq('user_id', userId);
        if (r.error) throw r.error;
    }

    // ---------------------------------------------------------------
    // SHIFTS
    // ---------------------------------------------------------------
    function mapShiftFrom(row) {
        return {
            id: row.id, staffName: row.staff_name, day: row.day,
            role: row.role, start: row.start_time, end: row.end_time,
            weekKey: row.week_key
        };
    }

    function mapShiftTo(s) {
        return {
            user_id: userId, staff_name: s.staffName, day: s.day,
            role: s.role, start_time: s.start, end_time: s.end,
            week_key: s.weekKey
        };
    }

    async function fetchShiftsForWeek(weekKey) {
        var r = await supabase.from('shifts').select('*').eq('user_id', userId).eq('week_key', weekKey);
        if (r.error) throw r.error;
        return (r.data || []).map(mapShiftFrom);
    }

    async function insertShift(shift) {
        var r = await supabase.from('shifts').insert(mapShiftTo(shift)).select().single();
        if (r.error) throw r.error;
        return mapShiftFrom(r.data);
    }

    async function updateShift(id, shift) {
        var db = mapShiftTo(shift);
        delete db.user_id;
        db.updated_at = new Date().toISOString();
        var r = await supabase.from('shifts').update(db).eq('id', id).eq('user_id', userId);
        if (r.error) throw r.error;
    }

    async function deleteShift(id) {
        var r = await supabase.from('shifts').delete().eq('id', id).eq('user_id', userId);
        if (r.error) throw r.error;
    }

    // ---------------------------------------------------------------
    // TASKS
    // ---------------------------------------------------------------
    function mapTaskFrom(row) {
        return {
            id: row.id, name: row.name, completed: row.completed,
            timestamp: row.completed_at, custom: row.custom, sortOrder: row.sort_order
        };
    }

    async function fetchTasksForDate(dateKey) {
        var r = await supabase.from('tasks').select('*').eq('user_id', userId)
            .eq('date_key', dateKey).order('sort_order', { ascending: true });
        if (r.error) throw r.error;

        if (!r.data || r.data.length === 0) {
            var defaults = DEFAULT_TASKS.map(function (name, i) {
                return { user_id: userId, name: name, date_key: dateKey, completed: false, custom: false, sort_order: i };
            });
            var ir = await supabase.from('tasks').insert(defaults).select();
            if (ir.error) throw ir.error;
            return (ir.data || []).map(mapTaskFrom);
        }
        return r.data.map(mapTaskFrom);
    }

    async function insertTask(dateKey, name, sortOrder) {
        var r = await supabase.from('tasks').insert({
            user_id: userId, name: name, date_key: dateKey,
            completed: false, custom: true, sort_order: sortOrder || 99
        }).select().single();
        if (r.error) throw r.error;
        return mapTaskFrom(r.data);
    }

    async function toggleTask(id, completed) {
        var r = await supabase.from('tasks').update({
            completed: completed,
            completed_at: completed ? new Date().toLocaleTimeString() : null
        }).eq('id', id).eq('user_id', userId);
        if (r.error) throw r.error;
    }

    async function deleteTask(id) {
        var r = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId);
        if (r.error) throw r.error;
    }

    async function deleteTasksForDate(dateKey) {
        var r = await supabase.from('tasks').delete().eq('user_id', userId).eq('date_key', dateKey);
        if (r.error) throw r.error;
    }

    // ---------------------------------------------------------------
    // MANAGED LISTS
    // ---------------------------------------------------------------
    async function fetchInstructors() {
        var r = await supabase.from('instructors').select('*').eq('user_id', userId).eq('active', true).order('name');
        return (r.data || []).map(function (d) { return { id: d.id, name: d.name, colorIndex: d.color_index }; });
    }

    async function addInstructor(name, colorIndex) {
        var r = await supabase.from('instructors').insert({ user_id: userId, name: name, color_index: colorIndex || 0 }).select().single();
        if (r.error) throw r.error;
        return { id: r.data.id, name: r.data.name, colorIndex: r.data.color_index };
    }

    async function removeInstructor(id) {
        await supabase.from('instructors').update({ active: false }).eq('id', id).eq('user_id', userId);
    }

    async function fetchHorses() {
        var r = await supabase.from('horses').select('*').eq('user_id', userId).eq('active', true).order('name');
        return (r.data || []).map(function (d) { return { id: d.id, name: d.name }; });
    }

    async function addHorse(name) {
        var r = await supabase.from('horses').insert({ user_id: userId, name: name }).select().single();
        if (r.error) throw r.error;
        return { id: r.data.id, name: r.data.name };
    }

    async function removeHorse(id) {
        await supabase.from('horses').update({ active: false }).eq('id', id).eq('user_id', userId);
    }

    async function fetchStaffMembers() {
        var r = await supabase.from('staff_members').select('*').eq('user_id', userId).eq('active', true).order('name');
        return (r.data || []).map(function (d) { return { id: d.id, name: d.name, defaultRole: d.default_role }; });
    }

    async function addStaffMember(name, defaultRole) {
        var r = await supabase.from('staff_members').insert({ user_id: userId, name: name, default_role: defaultRole || 'general' }).select().single();
        if (r.error) throw r.error;
        return { id: r.data.id, name: r.data.name, defaultRole: r.data.default_role };
    }

    async function removeStaffMember(id) {
        await supabase.from('staff_members').update({ active: false }).eq('id', id).eq('user_id', userId);
    }

    // ---------------------------------------------------------------
    // IMPORT FROM LOCALSTORAGE
    // ---------------------------------------------------------------
    async function importFromLocalStorage() {
        var imported = { lessons: 0, shifts: 0, tasks: 0 };

        try {
            var lsL = JSON.parse(localStorage.getItem('ss_lessons') || '[]');
            if (lsL.length > 0) {
                var rows = lsL.map(function (l) { return mapLessonTo(l); });
                var r = await supabase.from('lessons').insert(rows);
                if (!r.error) imported.lessons = lsL.length;
            }
        } catch (e) { /* skip */ }

        try {
            var lsS = JSON.parse(localStorage.getItem('ss_staff') || '[]');
            if (lsS.length > 0) {
                var rows = lsS.map(function (s) { return mapShiftTo(s); });
                var r = await supabase.from('shifts').insert(rows);
                if (!r.error) imported.shifts = lsS.length;
            }
        } catch (e) { /* skip */ }

        try {
            var lsT = JSON.parse(localStorage.getItem('ss_tasks') || '{}');
            var taskRows = [];
            Object.keys(lsT).forEach(function (dk) {
                if (Array.isArray(lsT[dk])) {
                    lsT[dk].forEach(function (t, i) {
                        taskRows.push({
                            user_id: userId, name: t.name, date_key: dk,
                            completed: t.completed || false, completed_at: t.timestamp || null,
                            custom: t.custom || false, sort_order: i
                        });
                    });
                }
            });
            if (taskRows.length > 0) {
                var r = await supabase.from('tasks').insert(taskRows);
                if (!r.error) imported.tasks = taskRows.length;
            }
        } catch (e) { /* skip */ }

        return imported;
    }

    // ---------------------------------------------------------------
    // OVERVIEW QUERIES
    // ---------------------------------------------------------------
    async function fetchTodayOverview(weekKey, dateKey, todayDayIndex) {
        var lessons = await fetchLessonsForWeek(weekKey);
        var shifts = await fetchShiftsForWeek(weekKey);
        var tasks = await fetchTasksForDate(dateKey);

        var todayLessons = lessons.filter(function (l) { return l.day === todayDayIndex; });
        var todayShifts = shifts.filter(function (s) { return s.day === todayDayIndex; });
        var completedTasks = tasks.filter(function (t) { return t.completed; }).length;

        todayLessons.sort(function (a, b) { return a.time.localeCompare(b.time); });
        todayShifts.sort(function (a, b) { return a.start.localeCompare(b.start); });

        return {
            lessons: todayLessons,
            shifts: todayShifts,
            tasks: tasks,
            tasksDone: completedTasks,
            tasksTotal: tasks.length
        };
    }

    // ---------------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------------
    return {
        init: init, getUserId: getUserId,
        getProfile: getProfile, updateProfile: updateProfile,
        fetchLessonsForWeek: fetchLessonsForWeek, insertLesson: insertLesson,
        updateLesson: updateLesson, deleteLesson: deleteLesson,
        fetchShiftsForWeek: fetchShiftsForWeek, insertShift: insertShift,
        updateShift: updateShift, deleteShift: deleteShift,
        fetchTasksForDate: fetchTasksForDate, insertTask: insertTask,
        toggleTask: toggleTask, deleteTask: deleteTask, deleteTasksForDate: deleteTasksForDate,
        fetchInstructors: fetchInstructors, addInstructor: addInstructor, removeInstructor: removeInstructor,
        fetchHorses: fetchHorses, addHorse: addHorse, removeHorse: removeHorse,
        fetchStaffMembers: fetchStaffMembers, addStaffMember: addStaffMember, removeStaffMember: removeStaffMember,
        importFromLocalStorage: importFromLocalStorage, fetchTodayOverview: fetchTodayOverview
    };
})();
