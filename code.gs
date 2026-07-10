/**
 * ระบบบันทึกเวลาทำงานรายวัน (Daily Attendance System)
 * สำนักจัดการทรัพยากรป่าไม้ที่ 7 (ขอนแก่น)
 */

var SPREADSHEET_ID = '1qSghlKLFv1oKjUgpawLvstQ9gVFxhchmO93FMzu37Ko';

var EMPLOYEE_SHEETS = {
  kharachakan: 'ข้าราชการ',
  luksang:     'ลูกจ้างประจำ',
  panakngan:   'พนักงานราชการ'
};

var EMPLOYEE_SHEET_KEYS = ['kharachakan', 'luksang', 'panakngan'];
var DATA_START_ROW = 8;
var SUMMARY_SHEET_NAME = 'สรุปรวม';

var STATUS_LABELS = {
  'W':  'ทำงาน',
  'OD': 'ไปราชการ',
  'SL': 'ลาป่วย',
  'PL': 'ลากิจ',
  'VL': 'พักผ่อน',
  'AB': 'ขาด',
  'LT': 'มาสาย',
  '':   '-'
};

var ALL_SECTIONS = [
  'ผู้อำนวยการสำนักจัดการทรัพยากรป่าไม้ที่ 7 ขอนแก่น','ส่วนอำนวยการ','ส่วนจัดการที่ดินป่าไม้','ส่วนจัดการป่าชุมชน','ส่วนป้องกันรักษาป่าและควบคุมไฟป่า',
  'ส่วนส่งเสริมการปลูกป่า','ส่วนโครงการพระราชดำริและกิจการพิเศษ','ส่วนการอนุญาต','ศูนย์ป่าไม้ขอนแก่น','ศูนย์ป่าไม้มหาสารคาม','ศูนย์ป่าไม้กาฬสินธุ์','ศูนย์ป่าไม้ร้อยเอ็ด','ศูนย์ป่าไม้มุกดาหาร'
];

var DEFAULT_THAI_HOLIDAYS = [
  '2025-01-01','2025-02-12','2025-04-06','2025-04-07','2025-04-08',
  '2025-04-14','2025-04-15','2025-05-01','2025-05-05','2025-05-12',
  '2025-06-03','2025-07-10','2025-07-28','2025-08-12','2025-10-13',
  '2025-10-23','2025-12-05','2025-12-10','2025-12-31'
];

function doGet(e) {
  var page = (e && e.parameter && e.parameter.p) ? e.parameter.p : 'login';
  var sk   = (e && e.parameter && e.parameter.sk) ? e.parameter.sk : '';

  var session = null;
  if (sk) session = getSessionByKey(sk);

  if (!session && page !== 'login') page = 'login';
  if (session  && page === 'login')  page = 'main';

  var template = HtmlService.createTemplateFromFile('index');
  template.page       = page;
  template.session    = session ? JSON.stringify(session) : 'null';
  template.sessionKey = sk;
  return template.evaluate()
    .setTitle('ระบบบันทึกเวลาทำงานรายวัน - สงน.7 ขอนแก่น')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

function setSession(user) {
  var key = 'sess_' + user.username + '_' + new Date().getTime();
  var payload = JSON.stringify({ user: user, expiry: new Date().getTime() + 8 * 3600 * 1000, key: key });
  PropertiesService.getScriptProperties().setProperty(key, payload);
  return key;
}

function getSessionByKey(key) {
  if (!key) return null;
  var str = PropertiesService.getScriptProperties().getProperty(key);
  if (!str) return null;
  try {
    var s = JSON.parse(str);
    if (new Date().getTime() > s.expiry) { PropertiesService.getScriptProperties().deleteProperty(key); return null; }
    
    // เติมสิทธิ์ประเภทพนักงานค่าเริ่มต้น หากไม่มีข้อมูล (เพื่อรองรับข้อมูลผู้ใช้เดิม)
    if (s.user && !s.user.empTypes) {
      s.user.empTypes = ['kharachakan', 'luksang', 'panakngan'];
    }
    return s.user;
  } catch(e) { return null; }
}

function loginUser(username, password) {
  var users;
  try {
    var usersJson = PropertiesService.getScriptProperties().getProperty('users');
    users = (usersJson && usersJson.trim()) ? JSON.parse(usersJson) : null;
  } catch(e) {
    PropertiesService.getScriptProperties().deleteProperty('users');
    users = null;
  }
  if (!users || !Array.isArray(users) || users.length === 0) users = getDefaultUsers();

  var found = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].username).trim() === String(username).trim() &&
        users[i].password === password) { found = users[i]; break; }
  }
  if (!found) return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' };
  
  // เติมสิทธิ์ประเภทพนักงานหากผู้ใช้เดิมไม่มี
  if (!found.empTypes) {
    found.empTypes = ['kharachakan', 'luksang', 'panakngan'];
  }
  
  var key = setSession(found);
  return { success: true, user: found, sessionKey: key };
}

function logoutUser(sessionKey) {
  try {
    if (sessionKey) PropertiesService.getScriptProperties().deleteProperty(sessionKey);
  } catch(e) {}
  return { success: true };
}

function getDefaultUsers() {
  var users = [
    { username: 'superadmin', password: 'admin1234', role: 'super_admin', name: 'Super Admin', sections: ALL_SECTIONS, empTypes: ['kharachakan', 'luksang', 'panakngan'] },
    { username: 'admin',      password: 'admin1234', role: 'admin',       name: 'แอดมินรอง',    sections: ALL_SECTIONS, empTypes: ['kharachakan', 'luksang', 'panakngan'] },
    { username: 'อำนวยการ',     password: 'admin1234', role: 'editor',      name: 'แอดมินอำนวยการ', sections: ['ส่วนอำนวยการ'], empTypes: ['kharachakan', 'luksang', 'panakngan'] }
  ];
  PropertiesService.getScriptProperties().setProperty('users', JSON.stringify(users));
  return users;
}

function apiHandler(action, data, sessionKey) {
  try {
    data = data || {};
    var user = getSessionByKey(sessionKey);

    switch (action) {
      case 'login':      return loginUser(data.username, data.password);
      case 'logout':     return logoutUser(sessionKey);
      
      // Dashboard API
      case 'getDashboardData':    return getDashboardData(data, user);
      case 'getDashboardMonthly': return getDashboardMonthly(data, user);
      case 'getDashboardYearly':  return getDashboardYearly(data, user);

      // Daily operations
      case 'getWorkingDays':     return getWorkingDays(data);
      case 'getDailyData':       return getDailyData(data, user);
      case 'saveDailyData':      return saveDailyData(data, user);
      case 'getDailySummary':    return getDailySummary(data, user);
      case 'getMonthSummary':    return getMonthSummary(data, user);
      case 'getYearlySummary':   return getYearlySummary(data, user);
      case 'refreshSummarySheet':return refreshSummarySheet(data, user);

      // Holidays
      case 'getHolidays':  return getHolidays();
      case 'saveHolidays': return saveHolidays(data, user);

      // Users
      case 'getUsers':   return getUsers(user);
      case 'saveUser':   return saveUserFn(data, user);
      case 'deleteUser': return deleteUserFn(data, user);

      // Employee Management
      case 'getEmployees':       return getEmployees(data, user);
      case 'saveEmployee':       return saveEmployee(data, user);
      case 'deleteEmployee':     return deleteEmployee(data, user);
      case 'syncEmployeesToDaily': return syncEmployeesToDaily(data, user);

      default: throw new Error('Unknown action: ' + action);
    }
  } catch(e) {
    return { success: false, message: e.toString() };
  }
}

// ตรวจสอบสิทธิ์ว่าเห็นได้ทุกส่วนงานหรือไม่ (super_admin และ admin)
function isAllSectionsRole(role) {
  return role === 'super_admin' || role === 'super' || role === 'admin';
}

function getDashboardData(data, user) {
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  var dateStr = data.date || formatDate(new Date());
  var dObj = new Date(dateStr);
  var year = dObj.getFullYear();
  var month = dObj.getMonth() + 1;
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // ตรวจสอบประเภทบุคลากรที่ได้รับสิทธิ์
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
  
  var requestedType = data.empType || 'all';
  var empTypes = (requestedType === 'all') ? allowedTypes : [requestedType];
  empTypes = empTypes.filter(function(et) { return allowedTypes.indexOf(et) !== -1; });
  
  var summary = { W:0, OD:0, SL:0, PL:0, VL:0, AB:0, LT:0, NONE:0 };
  var bySection = {};
  var total = 0;

  empTypes.forEach(function(et) {
    var sheetName = getDailySheetName(year, month, et);
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var meta = readSheetMeta(sheet);
    if (!meta) return;
    
    var days = meta.days;
    var dateIdx = days.indexOf(dateStr);
    var lastRow = sheet.getLastRow();
    
    if (dateIdx === -1 || lastRow < 7) return;

    var numColsToFetch = 6 + (dateIdx * 2);
    var vals = sheet.getRange(7, 1, lastRow - 6, numColsToFetch).getValues();
    
    vals.forEach(function(r) {
      if (!r[0] && !r[1] && !r[2]) return;
      var sec = String(r[4] || '').trim() || 'ไม่ระบุ';
      
      if (!isAllSectionsRole(user.role)) {
        var allowed = user.sections || [];
        if (allowed.indexOf(sec) === -1) return;
      }
      
      if (data.section && data.section !== 'all' && sec !== data.section) return;
      
      var st = String(r[5 + dateIdx * 2] || '').trim();
      
      if (summary.hasOwnProperty(st)) summary[st]++;
      else summary.NONE++;
      total++;
      
      if (!bySection[sec]) bySection[sec] = { section: sec, W:0, OD:0, LEAVE:0, AB_LT:0, NONE:0, total:0 };
      bySection[sec].total++;
      if (st === 'W') bySection[sec].W++;
      else if (st === 'OD') bySection[sec].OD++;
      else if (['SL','PL','VL'].indexOf(st) >= 0) bySection[sec].LEAVE++;
      else if (['AB','LT'].indexOf(st) >= 0) bySection[sec].AB_LT++;
      else bySection[sec].NONE++;
    });
  });
  
  var sectionArray = Object.keys(bySection).map(function(k) { return bySection[k]; });
  sectionArray.sort(function(a, b) { return a.section.localeCompare(b.section); });
  
  return { success: true, date: dateStr, total: total, summary: summary, sectionStats: sectionArray };
}

function getWorkingDaysInMonth(year, month) {
  var days = [];
  var d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    var dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      var ds = formatDate(d);
      days.push(ds);
    }
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getHolidaySet() {
  var stored = PropertiesService.getScriptProperties().getProperty('thai_holidays');
  return stored ? JSON.parse(stored) : DEFAULT_THAI_HOLIDAYS;
}

function getHolidays() { return { success: true, holidays: getHolidaySet() }; }

function saveHolidays(data, user) {
  if (!user || (user.role !== 'super_admin' && user.role !== 'super')) return { success: false, message: 'ไม่มีสิทธิ์' };
  
  var uniqueHols = [];
  (data.holidays || []).forEach(function(d) {
    if (uniqueHols.indexOf(d) === -1) uniqueHols.push(d);
  });
  uniqueHols.sort();
  
  PropertiesService.getScriptProperties().setProperty('thai_holidays', JSON.stringify(uniqueHols));
  return { success: true, message: 'บันทึกวันหยุดสำเร็จ' };
}

function getWorkingDays(data) {
  var year  = parseInt(data.year  || new Date().getFullYear());
  var month = parseInt(data.month || new Date().getMonth() + 1);
  var days  = getWorkingDaysInMonth(year, month);
  return { success: true, days: days, count: days.length };
}

function getDashboardMonthly(data, user) {
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  var year  = parseInt(data.year  || new Date().getFullYear());
  var month = parseInt(data.month || new Date().getMonth() + 1);
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var dayStats = {};

  // ตรวจสอบประเภทบุคลากรที่ได้รับสิทธิ์
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
  
  var requestedType = data.empType || 'all';
  var empTypes = (requestedType === 'all') ? allowedTypes : [requestedType];
  empTypes = empTypes.filter(function(et) { return allowedTypes.indexOf(et) !== -1; });

  empTypes.forEach(function(et) {
    var sheet = ss.getSheetByName(getDailySheetName(year, month, et));
    if (!sheet) return;
    var meta = readSheetMeta(sheet);
    if (!meta || sheet.getLastRow() < 7) return;
    var numCols = 5 + meta.days.length * 2;
    var vals = sheet.getRange(7, 1, sheet.getLastRow() - 6, numCols).getValues();
    vals.forEach(function(r) {
      if (!r[0] && !r[1] && !r[2]) return;
      var sec = String(r[4] || '').trim();
      
      if (!isAllSectionsRole(user.role)) {
        var allowed = user.sections || [];
        if (allowed.indexOf(sec) === -1) return;
      }
      
      if (data.section && data.section !== 'all' && sec !== data.section) return;

      meta.days.forEach(function(ds, i) {
        var st = String(r[5 + i * 2] || '').trim();
        if (!dayStats[ds]) dayStats[ds] = { date:ds, W:0, OD:0, LEAVE:0, AB:0, LT:0, total:0 };
        dayStats[ds].total++;
        if      (st === 'W')  dayStats[ds].W++;
        else if (st === 'OD') dayStats[ds].OD++;
        else if (['SL','PL','VL'].indexOf(st) >= 0) dayStats[ds].LEAVE++;
        else if (st === 'AB') dayStats[ds].AB++;
        else if (st === 'LT') dayStats[ds].LT++;
      });
    });
  });

  var arr = Object.values(dayStats).sort(function(a,b){ return a.date.localeCompare(b.date); });
  var totals = { W:0, OD:0, LEAVE:0, AB:0, LT:0, total:0 };
  arr.forEach(function(d) {
    totals.W+=d.W; totals.OD+=d.OD; totals.LEAVE+=d.LEAVE;
    totals.AB+=d.AB; totals.LT+=d.LT; totals.total+=d.total;
  });
  return { success:true, year:year, month:month, dayStats:arr, totals:totals };
}

function getDashboardYearly(data, user) {
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  var year = parseInt(data.year || new Date().getFullYear());
  var ss   = SpreadsheetApp.openById(SPREADSHEET_ID);
  var TH_M = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var monthlyStats = [];
  
  // ตรวจสอบประเภทบุคลากรที่ได้รับสิทธิ์
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
  
  var requestedType = data.empType || 'all';
  var empTypes = (requestedType === 'all') ? allowedTypes : [requestedType];
  empTypes = empTypes.filter(function(et) { return allowedTypes.indexOf(et) !== -1; });

  for (var m = 1; m <= 12; m++) {
    var mStat = { month:m, label:TH_M[m-1], W:0, OD:0, LEAVE:0, AB:0, LT:0, total:0 };
    empTypes.forEach(function(et) {
      var sheet = ss.getSheetByName(getDailySheetName(year, m, et));
      if (!sheet) return;
      var meta = readSheetMeta(sheet);
      if (!meta || sheet.getLastRow() < 7) return;
      var so   = 5 + meta.days.length * 2;
      var vals = sheet.getRange(7, 1, sheet.getLastRow() - 6, so + 7).getValues();
      vals.forEach(function(r) {
        if (!r[0] && !r[1] && !r[2]) return;
        var sec = String(r[4] || '').trim();
        if (!isAllSectionsRole(user.role)) {
          var allowed = user.sections || [];
          if (allowed.indexOf(sec) === -1) return;
        }
        
        if (data.section && data.section !== 'all' && sec !== data.section) return;

        mStat.total++;
        mStat.W     += toNum(r[so]);
        mStat.OD    += toNum(r[so + 1]);
        mStat.LEAVE += toNum(r[so + 2]) + toNum(r[so + 3]) + toNum(r[so + 4]);
        mStat.AB    += toNum(r[so + 5]);
        mStat.LT    += toNum(r[so + 6]);
      });
    });
    monthlyStats.push(mStat);
  }

  var totals = { W:0, OD:0, LEAVE:0, AB:0, LT:0, total:0 };
  monthlyStats.forEach(function(m) {
    totals.W+=m.W; totals.OD+=m.OD; totals.LEAVE+=m.LEAVE;
    totals.AB+=m.AB; totals.LT+=m.LT; totals.total+=m.total;
  });
  return { success:true, year:year, monthlyStats:monthlyStats, totals:totals };
}

function getDailySheetName(year, month, empType) {
  var label = empType === 'kharachakan' ? 'ข้าราชการ' : empType === 'luksang' ? 'ลูกจ้างประจำ' : 'พนักงานราชการ';
  return (year + 543) + '-' + String(month).padStart(2, '0') + ' ' + label;
}

function getOrCreateDailySheet(ss, year, month, empType) {
  var sheetName = getDailySheetName(year, month, empType);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { sheet = ss.insertSheet(sheetName); initDailySheet(ss, sheet, year, month, empType); }
  return sheet;
}

function initDailySheet(ss, sheet, year, month, empType) {
  var days = getWorkingDaysInMonth(year, month);
  var buddhistYear = year + 543;
  var thMonths = ['','มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

  sheet.getRange(1,1).setValue('สำนักจัดการทรัพยากรป่าไม้ที่ 7 (ขอนแก่น)');
  var empLabel = empType === 'kharachakan' ? 'ข้าราชการ' : empType === 'luksang' ? 'ลูกจ้างประจำ' : 'พนักงานราชการ';
  sheet.getRange(2,1).setValue('บันทึกเวลาทำงาน ' + empLabel + ' เดือน' + thMonths[month] + ' พ.ศ. ' + buddhistYear).setFontWeight('bold').setFontSize(13);
  sheet.getRange(3,1).setValue('วันทำการ (จ.-ศ.) ในเดือนนี้: ' + days.length + ' วัน');

  var headerRow = ['ลำดับ','ชื่อ','สกุล','ตำแหน่ง','ส่วน'];
  var subRow = ['','','','',''];
  days.forEach(function(ds) {
    var d = new Date(ds);
    headerRow.push(d.getDate() + '\n' + ['อา.','จ.','อ.','พ.','พฤ.','ศ.','ส.'][d.getDay()]); headerRow.push(''); 
    subRow.push('สถานะ'); subRow.push('หมายเหตุ');
  });
  ['วันทำการ','ไปราชการ','ลาป่วย','ลากิจ','พักผ่อน','ขาด','มาสาย'].forEach(function(h) { headerRow.push(h); subRow.push(''); });

  sheet.getRange(5, 1, 1, headerRow.length).setValues([headerRow]).setBackground('#1a5c2e').setFontColor('#ffffff').setFontWeight('bold').setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('center');
  sheet.getRange(6, 1, 1, subRow.length).setValues([subRow]).setBackground('#2e7d32').setFontColor('#ffffff').setFontSize(10);
  sheet.setFrozenRows(6); sheet.setFrozenColumns(5);
  sheet.setColumnWidth(1, 45); sheet.setColumnWidth(2, 120); sheet.setColumnWidth(3, 120); sheet.setColumnWidth(4, 160); sheet.setColumnWidth(5, 90);   
  for (var i = 0; i < days.length; i++) { sheet.setColumnWidth(6 + i * 2, 40); sheet.setColumnWidth(7 + i * 2, 80); }
  for (var j = 0; j < 7; j++) sheet.setColumnWidth(6 + days.length * 2 + j, 75);

  var master = ss.getSheetByName(EMPLOYEE_SHEETS[empType]);
  if (master && master.getLastRow() >= DATA_START_ROW) {
    var empData = master.getRange(DATA_START_ROW, 1, master.getLastRow() - DATA_START_ROW + 1, 5).getValues();
    var rowData = [], secData = [];
    var sectionData = master.getRange(DATA_START_ROW, 21, master.getLastRow() - DATA_START_ROW + 1, 1).getValues();
    empData.forEach(function(r, idx) {
      if (r[0] || r[1] || r[2]) { rowData.push([r[0], r[1], r[2], r[3], '']); secData.push([String(sectionData[idx][0] || '').trim()]); }
    });
    if (rowData.length > 0) { sheet.getRange(7, 1, rowData.length, 5).setValues(rowData); sheet.getRange(7, 5, secData.length, 1).setValues(secData); }
  }
  sheet.getRange(4,1).setValue(JSON.stringify({ days: days, year: year, month: month, empType: empType })).setFontSize(1).setFontColor('#ffffff'); 
  SpreadsheetApp.flush();
}

function readSheetMeta(sheet) {
  var raw = sheet.getRange(4,1).getValue();
  try { return raw ? JSON.parse(String(raw)) : null; } catch(e) { return null; }
}

function getDailyData(data, user) {
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  
  var year = parseInt(data.year || new Date().getFullYear()), month = parseInt(data.month || new Date().getMonth() + 1), empType = data.empType || 'kharachakan';
  
  // ตรวจสอบสิทธิ์ประเภทพนักงาน
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
  
  if (allowedTypes.indexOf(empType) === -1) {
    return { success: false, message: 'ท่านไม่มีสิทธิ์เข้าถึงข้อมูลประเภทบุคลากรนี้' };
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateDailySheet(ss, year, month, empType);
  var meta = readSheetMeta(sheet);
  if (!meta) return { success: false, message: 'ไม่พบข้อมูล metadata' };

  var days = meta.days, lastRow = sheet.getLastRow();
  if (lastRow < 7) { syncEmployeesFromMaster(ss, sheet, empType, days); lastRow = sheet.getLastRow(); }
  if (lastRow < 7) return { success: true, rows: [], days: days, holidays: getHolidaySet() };

  var numEmp = lastRow - 6, numCols = 5 + days.length * 2 + 7;
  var allValues = sheet.getRange(7, 1, numEmp, numCols).getValues();
  var rows = [];

  allValues.forEach(function(r, rowIdx) {
    if (!r[0] && !r[1] && !r[2]) return;
    var section = String(r[4] || '').trim();
    if (!isAllSectionsRole(user.role) && section !== '' && (user.sections || []).indexOf(section) === -1) return;
    if (data.section && data.section !== 'all' && section !== '' && section !== data.section) return;

    var dayData = {};
    days.forEach(function(ds, i) { dayData[ds] = { status: String(r[5 + i * 2] || '').trim(), remark: String(r[6 + i * 2] || '').trim() }; });
    var so = 5 + days.length * 2;
    rows.push({
      rowIndex: rowIdx + 7, seq: r[0], firstName: String(r[1] || '').trim(), lastName: String(r[2] || '').trim(),
      position: String(r[3] || '').trim(), section: section, days: dayData,
      totalWork: toNum(r[so]), totalOD: toNum(r[so+1]), totalSick: toNum(r[so+2]), totalPersonal: toNum(r[so+3]),
      totalVacation: toNum(r[so+4]), totalAbsent: toNum(r[so+5]), totalLate: toNum(r[so+6])
    });
  });
  return { success: true, rows: rows, days: days, year: year, month: month, empType: empType, holidays: getHolidaySet() };
}

function syncEmployeesFromMaster(ss, sheet, empType, days) {
  var master = ss.getSheetByName(EMPLOYEE_SHEETS[empType]);
  if (!master || master.getLastRow() < DATA_START_ROW) return;
  var empData = master.getRange(DATA_START_ROW, 1, master.getLastRow() - DATA_START_ROW + 1, 5).getValues();
  var sectionData = master.getRange(DATA_START_ROW, 21, master.getLastRow() - DATA_START_ROW + 1, 1).getValues();
  var rowData = [], secData = [];
  empData.forEach(function(r, idx) {
    if (r[0] || r[1] || r[2]) { rowData.push([r[0], r[1], r[2], r[3], '']); secData.push([String(sectionData[idx] ? sectionData[idx][0] : '').trim()]); }
  });
  if (rowData.length > 0) {
    sheet.getRange(7, 1, rowData.length, 5).setValues(rowData);
    sheet.getRange(7, 5, secData.length, 1).setValues(secData);
    if (days.length > 0) {
      var emptyGrid = Array(rowData.length).fill(Array(days.length * 2 + 7).fill(''));
      sheet.getRange(7, 6, rowData.length, days.length * 2 + 7).setValues(emptyGrid);
    }
    SpreadsheetApp.flush();
  }
}

function saveDailyData(data, user) {
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  
  var year = parseInt(data.year), month = parseInt(data.month), empType = data.empType;
  
  // ตรวจสอบสิทธิ์ประเภทพนักงาน
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
                     
  if (allowedTypes.indexOf(empType) === -1) {
    return { success: false, message: 'ท่านไม่มีสิทธิ์แก้ไขข้อมูลประเภทบุคลากรนี้' };
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateDailySheet(ss, year, month, empType);
  var meta = readSheetMeta(sheet);
  if (!meta) return { success: false, message: 'ไม่พบ metadata' };

  data.rows.forEach(function(r) {
    if (!r.rowIndex) return;
    if (!isAllSectionsRole(user.role)) { var sec = String(sheet.getRange(r.rowIndex, 5).getValue() || '').trim(); if (sec !== '' && user.sections.indexOf(sec) === -1) return; }
    meta.days.forEach(function(ds, i) {
      var de = (r.days && r.days[ds]) ? r.days[ds] : {};
      sheet.getRange(r.rowIndex, 6 + i * 2, 1, 2).setValues([[de.status || '', de.remark || '']]);
    });
    var counts = { W:0, OD:0, SL:0, PL:0, VL:0, AB:0, LT:0 };
    meta.days.forEach(function(ds) { var st = (r.days && r.days[ds]) ? r.days[ds].status : ''; if (counts.hasOwnProperty(st)) counts[st]++; });
    sheet.getRange(r.rowIndex, 6 + meta.days.length * 2, 1, 7).setValues([[counts.W, counts.OD, counts.SL, counts.PL, counts.VL, counts.AB, counts.LT]]);
  });
  SpreadsheetApp.flush();
  try { updateSummarySheetForMonth(ss, year, month, empType); updateMasterSheetWithSummary(ss, empType, data.rows); } catch(e) {}
  return { success: true, message: 'บันทึกสำเร็จ' };
}

function updateMasterSheetWithSummary(ss, empType, dailyRows) {
  var master = ss.getSheetByName(EMPLOYEE_SHEETS[empType]);
  if (!master || master.getLastRow() < DATA_START_ROW) return;
  var values = master.getRange(DATA_START_ROW, 1, master.getLastRow() - DATA_START_ROW + 1, 21).getValues();
  for (var i = 0; i < values.length; i++) {
    var fn = String(values[i][1] || '').trim(), ln = String(values[i][2] || '').trim();
    if (!fn && !ln) continue;
    var match = dailyRows.find(function(d) { return d.firstName === fn && d.lastName === ln; });
    if (match) {
      var counts = { W:0, OD:0, SL:0, PL:0, VL:0, AB:0, LT:0 };
      if (match.days) Object.keys(match.days).forEach(function(ds) { var st = match.days[ds].status; if (counts.hasOwnProperty(st)) counts[st]++; });
      master.getRange(DATA_START_ROW + i, 6, 1, 7).setValues([[counts.W, counts.OD, counts.SL, counts.PL, counts.VL, counts.AB, counts.LT]]);
    }
  }
}

function getDailySummary(data, user) {
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  var dateStr = data.date || formatDate(new Date());
  var dObj    = new Date(dateStr);
  var year    = dObj.getFullYear();
  var month   = dObj.getMonth() + 1;
  var result  = {};

  // ตรวจสอบสิทธิ์ประเภทพนักงาน
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);

  allowedTypes.forEach(function(et) {
    var dailyData = getDailyData(
      { year: year, month: month, empType: et, section: data.section || 'all' }, user);
    if (!dailyData.success || !dailyData.rows) { result[et] = []; return; }
    result[et] = dailyData.rows.map(function(row) {
      var entry = (row.days && row.days[dateStr]) ? row.days[dateStr] : {};
      return {
        firstName: row.firstName, lastName: row.lastName,
        position:  row.position,  section:  row.section,
        status:    entry.status || '',
        remark:    entry.remark || ''
      };
    });
  });

  var summary = { W:0, OD:0, SL:0, PL:0, VL:0, AB:0, LT:0, NONE:0, total:0 };
  Object.keys(result).forEach(function(et) {
    result[et].forEach(function(emp) {
      summary.total++;
      if (summary.hasOwnProperty(emp.status)) summary[emp.status]++;
      else summary.NONE++;
    });
  });

  return { success: true, date: dateStr, data: result, summary: summary };
}

function getMonthSummary(data, user) {
  var res = getDailyData(data, user);
  if (!res.success) return res;
  var bySection = {};
  res.rows.forEach(function(r) {
    var sec = r.section || 'ไม่ระบุ';
    if (!bySection[sec]) bySection[sec] = { section: sec, count:0, totalWork:0, totalOD:0, totalSick:0, totalPersonal:0, totalVacation:0, totalAbsent:0, totalLate:0 };
    bySection[sec].count++; bySection[sec].totalWork += r.totalWork; bySection[sec].totalOD += r.totalOD;
    bySection[sec].totalSick += r.totalSick; bySection[sec].totalPersonal += r.totalPersonal;
    bySection[sec].totalVacation += r.totalVacation; bySection[sec].totalAbsent += r.totalAbsent; bySection[sec].totalLate += r.totalLate;
  });
  return { success: true, summary: Object.values(bySection), rows: res.rows, year: data.year, month: data.month, days: res.days, empType: data.empType };
}

function getYearlySummary(data, user) {
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  
  var year = parseInt(data.year || new Date().getFullYear()), empType = data.empType || 'kharachakan';
  var targetSection = data.section || 'all';
  
  // ตรวจสอบสิทธิ์ประเภทพนักงาน
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
                     
  if (allowedTypes.indexOf(empType) === -1) {
    return { success: false, message: 'ท่านไม่มีสิทธิ์เข้าถึงข้อมูลประเภทบุคลากรนี้' };
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID), yearlySec = {}, yearlyEmp = {}; 
  for (var m = 1; m <= 12; m++) {
    var sheet = ss.getSheetByName(getDailySheetName(year, m, empType));
    if (!sheet) continue;
    var meta = readSheetMeta(sheet);
    if (!meta || sheet.getLastRow() < 7) continue;
    var vals = sheet.getRange(7, 1, sheet.getLastRow() - 6, 5 + meta.days.length * 2 + 7).getValues();
    vals.forEach(function(r) {
      if (!r[0] && !r[1] && !r[2]) return;
      var firstName = String(r[1] || '').trim();
      var lastName = String(r[2] || '').trim();
      var empName = firstName + ' ' + lastName;
      var sec = String(r[4] || '').trim() || 'ไม่ระบุ', so = 5 + meta.days.length * 2;
      
      if (!isAllSectionsRole(user.role)) {
        var allowed = user.sections || [];
        if (allowed.indexOf(sec) === -1) return;
      }
      
      if (targetSection !== 'all' && sec !== targetSection) return;
      
      if (!yearlySec[sec]) yearlySec[sec] = { section:sec, count:0, totalWork:0, totalOD:0, totalSick:0, totalPersonal:0, totalVacation:0, totalAbsent:0, totalLate:0, seenEmps:{} };
      if (!yearlySec[sec].seenEmps[empName]) { yearlySec[sec].seenEmps[empName] = true; yearlySec[sec].count++; }
      yearlySec[sec].totalWork += toNum(r[so]); yearlySec[sec].totalOD += toNum(r[so+1]);
      yearlySec[sec].totalSick += toNum(r[so+2]); yearlySec[sec].totalPersonal += toNum(r[so+3]);
      yearlySec[sec].totalVacation += toNum(r[so+4]); yearlySec[sec].totalAbsent += toNum(r[so+5]); yearlySec[sec].totalLate += toNum(r[so+6]);

      if (!yearlyEmp[empName]) yearlyEmp[empName] = { firstName: firstName, lastName: lastName, section: sec, totalWork:0, totalOD:0, totalSick:0, totalPersonal:0, totalVacation:0, totalAbsent:0, totalLate:0 };
      yearlyEmp[empName].totalWork += toNum(r[so]); yearlyEmp[empName].totalOD += toNum(r[so+1]);
      yearlyEmp[empName].totalSick += toNum(r[so+2]); yearlyEmp[empName].totalPersonal += toNum(r[so+3]);
      yearlyEmp[empName].totalVacation += toNum(r[so+4]); yearlyEmp[empName].totalAbsent += toNum(r[so+5]); yearlyEmp[empName].totalLate += toNum(r[so+6]);
    });
  }
  return { success: true, summary: Object.values(yearlySec), employeeSummary: Object.values(yearlyEmp), year: year, empType: empType };
}

function updateSummarySheetForMonth(ss, year, month, empType) {
  var summarySheet = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (!summarySheet) { summarySheet = ss.insertSheet(SUMMARY_SHEET_NAME, 0); initSummarySheet(summarySheet); }
  var dailySheet = ss.getSheetByName(getDailySheetName(year, month, empType));
  if (!dailySheet) return;
  var meta = readSheetMeta(dailySheet);
  if (!meta || dailySheet.getLastRow() < 7) return;
  var vals = dailySheet.getRange(7, 1, dailySheet.getLastRow() - 6, 5 + meta.days.length * 2 + 7).getValues();
  var t = { count:0, w:0, od:0, s:0, p:0, v:0, ab:0, lt:0 };
  vals.forEach(function(r) {
    if (!r[0] && !r[1] && !r[2]) return;
    var so = 5 + meta.days.length * 2;
    t.count++; t.w += toNum(r[so]); t.od += toNum(r[so+1]); t.s += toNum(r[so+2]); t.p += toNum(r[so+3]); t.v += toNum(r[so+4]); t.ab += toNum(r[so+5]); t.lt += toNum(r[so+6]);
  });
  var empLabel = empType === 'kharachakan' ? 'ข้าราชการ' : empType === 'luksang' ? 'ลูกจ้างประจำ' : 'พนักงานราชการ';
  var newRow = [year + 543, month, empLabel, meta.days.length, t.count, t.w, t.od, t.s, t.p, t.v, t.ab, t.lt];
  var found = -1, lastRow = summarySheet.getLastRow();
  if (lastRow >= 3) {
    summarySheet.getRange(3, 1, lastRow - 2, 3).getValues().forEach(function(r, idx) {
      if (toNum(r[0]) === year + 543 && toNum(r[1]) === month && String(r[2]).trim() === empLabel) found = idx + 3;
    });
  }
  summarySheet.getRange(found > 0 ? found : (lastRow < 2 ? 3 : lastRow + 1), 1, 1, newRow.length).setValues([newRow]);
  SpreadsheetApp.flush();
}

function initSummarySheet(sheet) {
  sheet.getRange(1,1).setValue('สรุปรวมข้อมูลการทำงาน - สงน.7 ขอนแก่น').setFontWeight('bold').setFontSize(14);
  sheet.getRange(1,1,1,12).merge().setBackground('#1a5c2e').setFontColor('#fff').setHorizontalAlignment('center');
  var h = ['ปี พ.ศ.','เดือน','ประเภทพนักงาน','วันราชการ','จำนวน(คน)','วันทำการ','ไปราชการ','ลาป่วย','ลากิจ','พักผ่อน','ขาด','มาสาย(ครั้ง)'];
  sheet.getRange(2, 1, 1, h.length).setValues([h]).setBackground('#2e7d32').setFontColor('#fff').setFontWeight('bold').setHorizontalAlignment('center');
  sheet.setFrozenRows(2);
  [70, 60, 130, 80, 80, 80, 80, 80, 80, 80, 80, 100].forEach(function(w, i) { sheet.setColumnWidth(i+1, w); });
}

function refreshSummarySheet(data, user) {
  if (!user || (user.role !== 'super_admin' && user.role !== 'super')) return { success: false, message: 'ไม่มีสิทธิ์' };
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var old = ss.getSheetByName(SUMMARY_SHEET_NAME);
  if (old) ss.deleteSheet(old);
  initSummarySheet(ss.insertSheet(SUMMARY_SHEET_NAME, 0));
  ss.getSheets().forEach(function(sh) { var m = readSheetMeta(sh); if (m) updateSummarySheetForMonth(ss, m.year, m.month, m.empType); });
  return { success: true, message: 'รีเฟรช sheet สรุปรวมสำเร็จ' };
}

function getUsers(user) {
  if (!user || (user.role !== 'super_admin' && user.role !== 'super')) return { success: false, message: 'ไม่มีสิทธิ์' };
  return { success: true, users: (JSON.parse(PropertiesService.getScriptProperties().getProperty('users') || '[]')).map(function(u){ return {username:u.username, role:u.role, name:u.name, sections:u.sections, empTypes:u.empTypes || ['kharachakan', 'luksang', 'panakngan']}; }) };
}
function saveUserFn(data, user) {
  if (!user || (user.role !== 'super_admin' && user.role !== 'super')) return { success: false, message: 'ไม่มีสิทธิ์' };
  var users = JSON.parse(PropertiesService.getScriptProperties().getProperty('users') || '[]');
  var idx = users.findIndex(function(u){ return u.username === data.username; });
  var n = { 
    username: data.username, 
    password: data.password || (idx >= 0 ? users[idx].password : 'admin1234'), 
    role: data.role || 'editor', 
    name: data.name || data.username, 
    sections: data.sections || [],
    empTypes: data.empTypes || ['kharachakan', 'luksang', 'panakngan']
  };
  if (idx >= 0) users[idx] = n; else users.push(n);
  PropertiesService.getScriptProperties().setProperty('users', JSON.stringify(users));
  return { success: true, message: 'บันทึกผู้ใช้สำเร็จ' };
}
function deleteUserFn(data, user) {
  if (!user || (user.role !== 'super_admin' && user.role !== 'super')) return { success: false, message: 'ไม่มีสิทธิ์' };
  var users = JSON.parse(PropertiesService.getScriptProperties().getProperty('users') || '[]').filter(function(u){ return u.username !== data.username; });
  PropertiesService.getScriptProperties().setProperty('users', JSON.stringify(users));
  return { success: true, message: 'ลบผู้ใช้สำเร็จ' };
}

function toNum(v) { var n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; }
function formatDate(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

// ==========================================
//  ระบบจัดการบุคลากร (Admin Employees Management)
// ==========================================
function getEmployees(data, user) {
  if (!user || !isAllSectionsRole(user.role)) return { success: false, message: 'ไม่มีสิทธิ์' };
  
  var empType = data.empType || 'kharachakan';
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
                     
  if (allowedTypes.indexOf(empType) === -1) {
    return { success: false, message: 'ท่านไม่มีสิทธิ์เข้าถึงข้อมูลประเภทบุคลากรนี้' };
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(EMPLOYEE_SHEETS[empType]);
  if (!sheet) return { success: false, message: 'ไม่พบฐานข้อมูลชีท' };
  
  var lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return { success: true, employees: [] };
  
  var vals = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 21).getValues();
  var emps = [];
  vals.forEach(function(r, i) {
    if (String(r[1]).trim() !== '' || String(r[2]).trim() !== '') {
      emps.push({
        rowIndex: DATA_START_ROW + i,
        seq: r[0],
        firstName: r[1],
        lastName: r[2],
        position: r[3],
        section: r[20]
      });
    }
  });
  return { success: true, employees: emps };
}

function saveEmployee(data, user) {
  if (!user || !isAllSectionsRole(user.role)) return { success: false, message: 'ไม่มีสิทธิ์' };
  
  var empType = data.empType || 'kharachakan';
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
                     
  if (allowedTypes.indexOf(empType) === -1) {
    return { success: false, message: 'ท่านไม่มีสิทธิ์จัดการข้อมูลประเภทบุคลากรนี้' };
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(EMPLOYEE_SHEETS[empType]);
  if (!sheet) return { success: false, message: 'ไม่พบฐานข้อมูลชีท' };
  
  if (data.rowIndex) {
    sheet.getRange(data.rowIndex, 1).setValue(data.seq);
    sheet.getRange(data.rowIndex, 2).setValue(data.firstName);
    sheet.getRange(data.rowIndex, 3).setValue(data.lastName);
    sheet.getRange(data.rowIndex, 4).setValue(data.position);
    sheet.getRange(data.rowIndex, 21).setValue(data.section);
  } else {
    var lastRow = Math.max(sheet.getLastRow(), DATA_START_ROW - 1);
    var newRow = lastRow + 1;
    sheet.getRange(newRow, 1).setValue(data.seq);
    sheet.getRange(newRow, 2).setValue(data.firstName);
    sheet.getRange(newRow, 3).setValue(data.lastName);
    sheet.getRange(newRow, 4).setValue(data.position);
    sheet.getRange(newRow, 21).setValue(data.section);
  }
  return { success: true, message: 'บันทึกสำเร็จ' };
}

function deleteEmployee(data, user) {
  if (!user || !isAllSectionsRole(user.role)) return { success: false, message: 'ไม่มีสิทธิ์' };
  
  var empType = data.empType || 'kharachakan';
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
                     
  if (allowedTypes.indexOf(empType) === -1) {
    return { success: false, message: 'ท่านไม่มีสิทธิ์จัดการข้อมูลประเภทบุคลากรนี้' };
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(EMPLOYEE_SHEETS[empType]);
  if (!sheet) return { success: false, message: 'ไม่พบฐานข้อมูลชีท' };
  
  sheet.deleteRow(data.rowIndex);
  return { success: true, message: 'ลบข้อมูลสำเร็จ' };
}

function syncEmployeesToDaily(data, user) {
  if (!user) return { success: false, message: 'กรุณาเข้าสู่ระบบ' };
  
  var year = parseInt(data.year), month = parseInt(data.month), empType = data.empType;
  
  // ตรวจสอบสิทธิ์ประเภทพนักงาน
  var allowedTypes = (user.role === 'super_admin' || user.role === 'super') 
                     ? ['kharachakan', 'luksang', 'panakngan'] 
                     : (user.empTypes || ['kharachakan', 'luksang', 'panakngan']);
                     
  if (allowedTypes.indexOf(empType) === -1) {
    return { success: false, message: 'ท่านไม่มีสิทธิ์จัดการข้อมูลประเภทบุคลากรนี้' };
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var dailySheet = ss.getSheetByName(getDailySheetName(year, month, empType));
  if (!dailySheet) return { success: false, message: 'ยังไม่มีชีทรายวันของเดือนนี้ (กรุณากดโหลดเพื่อสร้างใหม่)' };
  
  var meta = readSheetMeta(dailySheet);
  if (!meta) return { success: false, message: 'Metadata ชีทรายวันไม่ถูกต้อง' };
  
  var master = ss.getSheetByName(EMPLOYEE_SHEETS[empType]);
  if (!master || master.getLastRow() < DATA_START_ROW) return { success: true, message: 'ไม่มีข้อมูลในฐานข้อมูลหลัก' };
  
  var masterVals = master.getRange(DATA_START_ROW, 1, master.getLastRow() - DATA_START_ROW + 1, 21).getValues();
  var masterEmps = [];
  masterVals.forEach(function(r) {
    if (String(r[1]).trim() !== '' || String(r[2]).trim() !== '') {
      masterEmps.push({
        seq: r[0], fn: String(r[1]).trim(), ln: String(r[2]).trim(), 
        pos: String(r[3]).trim(), sec: String(r[20]).trim()
      });
    }
  });
  
  var dailyLastRow = dailySheet.getLastRow();
  var dailyEmps = [];
  if (dailyLastRow >= 7) {
    var dailyVals = dailySheet.getRange(7, 1, dailyLastRow - 6, 3).getValues();
    dailyVals.forEach(function(r) { 
      dailyEmps.push(String(r[1]).trim() + '|' + String(r[2]).trim()); 
    });
  }
  
  var newRowsData = [];
  var newSecData = [];
  masterEmps.forEach(function(me) {
    var key = me.fn + '|' + me.ln;
    if (dailyEmps.indexOf(key) === -1) {
      newRowsData.push([me.seq, me.fn, me.ln, me.pos, '']);
      newSecData.push([me.sec]);
    }
  });
  
  if (newRowsData.length > 0) {
    var startRow = dailyLastRow + 1;
    dailySheet.getRange(startRow, 1, newRowsData.length, 5).setValues(newRowsData);
    dailySheet.getRange(startRow, 5, newSecData.length, 1).setValues(newSecData);
    var emptyGrid = Array(newRowsData.length).fill(Array(meta.days.length * 2 + 7).fill(''));
    dailySheet.getRange(startRow, 6, newRowsData.length, meta.days.length * 2 + 7).setValues(emptyGrid);
    SpreadsheetApp.flush();
    return { success: true, message: 'เพิ่ม ' + newRowsData.length + ' รายชื่อใหม่ลงตารางเรียบร้อยแล้ว' };
  }
  
  return { success: true, message: 'รายชื่อทั้งหมดอัปเดตตรงกันแล้ว (ไม่มีคนใหม่)' };
}
