import { initConfirm } from './modules/confirm.js';
import { renderRoles, initRoleEvents } from './modules/role.js';
import { renderEmployees, initEmployeeEvents } from './modules/employee.js';
import { renderRekap, initRekapEvents } from './modules/rekap.js';
import { renderBasecamps, initBasecampEvents } from './modules/basecamp.js';
import { initAttendanceEvents } from './modules/attendance.js';
import { initNavigationEvents } from './modules/navigation.js';

window.addEventListener('DOMContentLoaded', () => {
    initConfirm();
    initRoleEvents();
    initEmployeeEvents();
    initBasecampEvents();
    initRekapEvents();
    initAttendanceEvents();
    initNavigationEvents();

    renderRoles();
    renderEmployees();
    renderRekap();
    renderBasecamps();
});