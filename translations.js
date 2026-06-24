// ==========================================
// نظام الترجمة ثنائي اللغة | Bilingual Translation System
// Arabic ↔ English
// ==========================================

const translations = {
    ar: {
        // System
        page_title: 'SpeedPro ERP - سبيد برو',
        sys_subtitle: 'نظام تخطيط موارد المؤسسة (ERP)',
        developer: 'Developed by Magdy Saleh © 2026',
        lang_switch: 'English',
        // === الأقسام الجديدة: الرئيسية / السيارات / الموارد البشرية ===
        tab_home: 'الرئيسية', tab_cars: 'قسم السيارات 🚗', tab_hr: 'منصات 👥',
        home_title: 'لوحة التحكم الرئيسية', home_subtitle: 'نظرة شاملة على كل المنصات والأقسام',
        home_chart_orders: 'مقارنة الطلبات بين المنصات', home_chart_status: 'حالة الحسابات (متاح / مستعمل)',
        home_chart_accounts: 'توزيع الحسابات على المنصات', home_supervisors: 'حالة المشرفين',
        home_alerts: 'التنبيهات الذكية', home_finance: 'الملخص المالي العام',
        home_kpi_accounts: 'إجمالي الحسابات', home_inuse: 'قيد الاستخدام', home_today_orders: 'طلبات اليوم',
        home_total_orders: 'الطلبات التراكمية', home_kpi_cars: 'السيارات', home_kpi_emps: 'الموظفين',
        home_accounts_count: 'عدد الحسابات', home_no_supervisors: 'لا يوجد مشرفين',
        home_online: 'متصل', home_offline: 'غير متصل', role_super: 'مدير النظام', role_supervisor: 'مشرف',
        home_no_alerts: 'لا توجد تنبيهات حالياً 👌', alert_expired: 'منتهية ⚠️', alert_in: 'خلال', alert_days: 'يوم',
        alert_suspended_accounts: 'حسابات موقوفة',
        fin_fuel_accounts: 'وقود الحسابات', fin_fuel_cars: 'وقود السيارات', fin_violations: 'المخالفات المرورية',
        fin_salaries: 'رواتب الموظفين', fin_total_monthly: 'الإجمالي الشهري التقديري',
        currency_sar: 'ر.س', unit_km: 'كم', btn_export: 'تصدير Excel', btn_cancel: 'إلغاء', btn_save: 'حفظ',
        cars_title: 'إدارة أسطول السيارات', cars_subtitle: 'متابعة السيارات والوثائق والصيانة والمخالفات',
        cars_tab_fleet: 'السيارات', cars_tab_chips: 'شرائح البنزين', cars_tab_accidents: 'الحوادث', cars_tab_maintenance: 'الصيانة', cars_tab_handover: 'الاستلام', cars_tab_rental: 'الإيجار',
        btn_export_short: 'تصدير', cars_add_vehicle: 'إضافة مركبة', cars_add_chip: 'إضافة شريحة', cars_add_accident: 'تسجيل حادثة', cars_add_maint: 'إضافة صيانة', cars_add_handover: 'استلام / تسليم', cars_add_rental: 'عقد إيجار جديد',
        export_choose: 'اختر ما تريد تصديره', export_fleet_label: 'الأسطول — بيانات السيارات', export_chips_label: 'شرائح البنزين', export_accidents_label: 'سجل الحوادث', export_maint_label: 'سجل الصيانة الدورية', export_handover_label: 'سجل الاستلام والتسليم', export_rental_label: 'عقود الإيجار',
        rental_modal_title: 'عقد إيجار سيارة', rental_car: 'السيارة المؤجَّرة', rental_plate: 'لوحة السيارة', rental_renter_name: 'اسم المستأجر', rental_renter_id: 'رقم الهوية / الإقامة', rental_phone: 'الجوال', rental_start: 'تاريخ البداية', rental_end: 'تاريخ النهاية', rental_daily_rate: 'الإيجار اليومي (ر.س)', rental_deposit: 'الوديعة (ر.س)', rental_total: 'الإجمالي (ر.س)', rental_paid: 'المبلغ المدفوع (ر.س)', rental_status: 'حالة العقد', rental_deposit_returned: 'الوديعة مُستردة', rental_notes: 'ملاحظات',
        rental_th_renter: 'المستأجر', rental_th_car: 'السيارة', rental_th_period: 'فترة الإيجار', rental_th_daily: 'اليومي', rental_th_total: 'الإجمالي', rental_th_paid: 'المدفوع', rental_th_deposit: 'الوديعة', rental_th_status: 'الحالة', rental_th_actions: 'التحكم',
        export_all_label: 'تصدير الكل — ملف Excel واحد', export_all_sub: '5 أوراق عمل في ملف واحد',
        filter_vehicle_type: 'نوع المركبة', filter_status: 'الحالة', filter_clear: 'إلغاء جميع الفلاتر', filter_all: 'الكل',
        cars_add: 'إضافة سيارة', cars_search_ph: 'بحث برقم اللوحة، النوع، السائق...',
        cars_th_vehicle: 'السيارة', cars_th_driver: 'السائق المسؤول', cars_th_status: 'الحالة',
        cars_th_reg: 'الاستمارة', cars_th_insurance: 'التأمين', cars_th_inspection: 'الفحص الدوري',
        cars_th_maint: 'الزيت / الكيلومترات', cars_th_violations: 'المخالفات / الوقود', cars_th_ctrl: 'التحكم',
        car_modal_title: 'بيانات السيارة', car_plate: 'رقم اللوحة', car_type: 'النوع / الماركة',
        car_model: 'الموديل / السنة', car_driver: 'السائق / الموظف المسؤول', car_status: 'الحالة',
        car_status_active: 'تعمل', car_status_maint: 'في الصيانة', car_status_stopped: 'متوقفة',
        car_sec_docs: '📄 الوثائق وتواريخ الانتهاء', car_reg_exp: 'انتهاء الاستمارة', car_ins_exp: 'انتهاء التأمين',
        car_insp_exp: 'انتهاء الفحص الدوري', car_sec_maint: '🔧 الصيانة والوقود', car_odometer: 'قراءة العداد (كم)',
        car_last_oil: 'آخر تغيير زيت (كم)', car_next_maint: 'الصيانة القادمة', car_fuel: 'تكلفة الوقود الشهري',
        car_violations: 'عدد المخالفات', car_violations_cost: 'قيمة المخالفات (ر.س)', car_notes: 'ملاحظات',
        cars_empty: 'لا توجد سيارات مسجلة. اضغط "إضافة سيارة" للبدء.', cars_violations_short: 'مخالفة',
        cars_kpi_total: 'إجمالي السيارات', cars_kpi_active: 'تعمل', cars_kpi_maint: 'في الصيانة',
        cars_kpi_expiring: 'وثائق قرب الانتهاء', cars_plate_required: 'يرجى إدخال رقم اللوحة',
        hr_title: 'منصات', hr_subtitle: 'ملفات الموظفين والرواتب والحضور والمستندات',
        hr_add: 'إضافة موظف', hr_search_ph: 'بحث بالاسم، الرقم الوظيفي، الوظيفة...',
        hr_th_emp: 'الموظف', hr_th_id: 'الهوية / الإقامة', hr_th_contact: 'الجوال / المشرف',
        hr_th_salary: 'الراتب (صافي)', hr_th_attendance: 'الحضور / الإجازات', hr_th_docs: 'المستندات', hr_th_ctrl: 'التحكم',
        hr_modal_title: 'بيانات الموظف', hr_sec_file: '👤 ملف الموظف', hr_name: 'الاسم', hr_emp_num: 'الرقم الوظيفي',
        hr_job: 'الوظيفة', hr_national_id: 'رقم الهوية / الإقامة', hr_phone: 'رقم الجوال', hr_hire_date: 'تاريخ التعيين',
        hr_supervisor: 'المشرف المسؤول', hr_emp_status: 'الحالة الوظيفية', hr_status_active: 'نشط',
        hr_status_leave: 'في إجازة', hr_status_suspended: 'موقوف', hr_sec_salary: '💰 الراتب والبدلات',
        hr_basic: 'الراتب الأساسي', hr_allowance: 'البدلات', hr_deduction: 'الخصومات', hr_net: 'صافي الراتب',
        hr_sec_attendance: '🗓️ الحضور والإجازات', hr_leave_balance: 'رصيد الإجازات (أيام)', hr_absence: 'أيام الغياب هذا الشهر',
        hr_sec_docs: '📄 المستندات وتواريخ الانتهاء', hr_iqama_exp: 'انتهاء الإقامة', hr_license_exp: 'انتهاء الرخصة',
        hr_contract_exp: 'انتهاء العقد', hr_notes: 'ملاحظات',
        hr_empty: 'لا يوجد موظفين مسجلين. اضغط "إضافة موظف" للبدء.', hr_leave_short: 'إجازات', hr_absence_short: 'غياب',
        hr_iqama_short: 'الإقامة', hr_license_short: 'الرخصة', hr_contract_short: 'العقد',
        hr_kpi_total: 'إجمالي الموظفين', hr_kpi_active: 'نشط', hr_kpi_leave: 'في إجازة', hr_kpi_salaries: 'إجمالي الرواتب',
        hr_name_required: 'يرجى إدخال اسم الموظف', saved_success: 'تم الحفظ بنجاح ✅', no_data_export: 'لا توجد بيانات للتصدير',
        hr_modal_title: 'بيانات العمل والراتب', hr_edit_data: 'تعديل البيانات', hr_clear_data: 'مسح بيانات العمل',
        confirm_delete_car: 'هل أنت متأكد من حذف هذه السيارة؟', confirm_delete_emp: 'هل أنت متأكد من حذف هذا الموظف؟',
        swal_notify_title: 'إشعار النظام',
        swal_ok: 'حسناً',
        // Driver Docs
        hr_subtab_emp: '👥 ملفات الموظفين', hr_subtab_docs: '📄 وثائق المناديب',
        docs_kpi_total_drivers: 'إجمالي المناديب', docs_kpi_expired: 'وثائق منتهية', docs_kpi_expiring: 'قرب الانتهاء',
        docs_kpi_missing: 'غير مرفوعة', docs_kpi_valid: 'وثائق سارية',
        docs_filter_all: 'الكل', docs_filter_expired: 'منتهية', docs_filter_expiring: 'قرب الانتهاء',
        docs_filter_valid: 'سارية', docs_filter_missing: 'غير مرفوعة',
        docs_th_driver: 'المندوب', docs_th_iqama: 'صورة الإقامة', docs_th_light_lic: 'رخصة نقل خفيف',
        docs_th_moto_lic: 'رخصة دراجة آلية', docs_th_driver_card: 'كرت السائق',
        docs_th_health: 'الشهادة الصحية', docs_th_contract: 'عقد التشاركي', docs_th_actions: 'إجراءات',
        docs_manage: 'إدارة الوثائق', docs_not_uploaded: 'غير مرفوعة', docs_uploaded_no_date: 'مرفوعة',
        docs_valid: 'سارية', docs_no_drivers: 'لا يوجد مناديب مسجلين.', docs_no_match_filter: 'لا توجد نتائج لهذا الفلتر.',
        docs_view: 'معاينة', docs_no_file_yet: 'لم يتم رفع ملف بعد',
        docs_expiry_date: 'تاريخ الانتهاء', docs_save_date: 'حفظ التاريخ', docs_upload_file: 'رفع الملف',
        docs_upload_btn: 'رفع ملف', docs_replace_file: 'استبدال الملف', docs_last_upload: 'آخر رفع',
        docs_file_too_large: 'حجم الملف كبير جداً. الحد الأقصى 10 ميجابايت.',
        docs_upload_error: 'حدث خطأ أثناء رفع الملف', docs_search_ph: 'بحث عن مندوب...',
        docs_modal_title: 'وثائق المندوب', docs_viewer_title: 'معاينة الوثيقة',
        docs_select_all: 'تحديد الكل', docs_delete_selected: 'حذف المحدد',
        docs_none_selected: 'لم تحدد أي مندوب.', docs_confirm_delete_selected: 'هل تريد حذف كل وثائق هؤلاء المناديب؟',
        docs_download: 'تحميل الملف', docs_download_all: 'تحميل كل الوثائق (ZIP)',
        docs_download_zip: 'ZIP تحميل', docs_downloading: 'جاري التحميل...',
        docs_no_files_to_download: 'لا توجد ملفات مرفوعة لهذا المندوب.',
        docs_download_error: 'حدث خطأ أثناء تحميل الملفات',

        // Login
        username_label: 'اسم المستخدم',
        password_label: 'كلمة المرور',
        remember_me: 'تذكر بياناتي',
        login_btn: 'دخول النظام',

        // Nav Tabs
        tab_ninja: 'منصة نينجا',
        tab_keeta: 'منصة كيتا',
        tab_hunger: 'منصة هنقرستيشن',
        tab_jahez: 'منصة جاهز',
        tab_chefz: 'ذا شفز',
        platforms_delivery: 'منصات التوصيل',
        tab_finance: 'المالية 💰',

        // Sidebar
        sidebar_title: 'مركز الإدارة',
        section_settings: 'إعدادات النظام',
        section_ops: 'العمليات التشغيلية',
        section_data: 'إدارة البيانات',
        btn_locks: 'أقفال الأقسام',
        btn_admins: 'إدارة المشرفين',
        btn_defaulters: 'إنذار المقصرين 🚨',
        btn_archive: 'أرشيف الشهور',
        btn_fuel_modal: 'تكاليف البنزين',
        btn_trash: 'المحذوفات',
        btn_dark: 'الوضع الليلي',
        btn_import_fuel: 'استيراد تكاليف بنزين',
        btn_backup: 'أخذ نسخة (Backup)',
        btn_driver_template: 'قالب مستخدم',
        btn_perf_template: 'قالب أداء',
        btn_add_manual: 'إضافة يدوية',
        btn_smart_paste: 'لصق ذكي',
        btn_import_drivers: 'استيراد مناديب',
        btn_import_perf: 'استيراد أداء',
        btn_late_report: 'تقرير يومي متأخر',
        btn_fix_dup: 'تنظيف التكرار',
        btn_set_dates: 'تعيين تاريخ الاستلام إلى أول الشهر',
        btn_reset: 'تصفير مخصص',
        btn_logout: 'تسجيل خروج',
        btn_sys_tools: 'أدوات النظام',

        // Platform Banners
        ops_platform: 'المنصة التشغيلية',
        banner_ninja: 'إدارة نينجا 🥷',
        banner_keeta: 'إدارة كيتا 🚴',
        banner_hunger: 'إدارة هنقرستيشن 📦',
        banner_jahez: 'إدارة جاهز 🛒',
        banner_chefz: 'إدارة ذا شفز 👨‍🍳',

        // AI Radar
        ai_radar: 'رادار الذكاء الاصطناعي',
        ai_loading: 'جاري تحليل البيانات...',

        // Stats - Ninja
        stat_total_ninja: 'إجمالي الحسابات',
        stat_avail_ninja: 'حسابات متاحة',
        stat_used_ninja: 'قيد الاستخدام',
        stat_orders_ninja: 'إجمالي الطلبات',
        // Stats - Keeta
        stat_total_keeta: 'إجمالي كيتا',
        stat_avail_keeta: 'متاح للعمل',
        stat_used_keeta: 'قيد العمل',
        stat_orders_keeta: 'إجمالي الطلبات',
        // Stats - Hunger
        stat_total_hunger: 'إجمالي هنقرستيشن',
        stat_avail_hunger: 'متاح للعمل',
        stat_used_hunger: 'قيد العمل',
        stat_orders_hunger: 'إجمالي الطلبات',
        // Stats - Jahez
        stat_total_jahez: 'إجمالي جاهز',
        stat_avail_jahez: 'متاح للعمل',
        stat_used_jahez: 'قيد العمل',
        stat_orders_jahez: 'إجمالي الطلبات',
        // Stats - Chefz
        stat_total_chefz: 'إجمالي ذا شفز',
        stat_avail_chefz: 'متاح للعمل',
        stat_used_chefz: 'قيد العمل',
        stat_orders_chefz: 'إجمالي الطلبات',

        // Filters
        filter_all: 'عرض الكل',
        filter_avail: 'المتاح فقط',
        filter_used: 'المستعمل',
        filter_all_short: 'الكل',
        filter_avail_short: 'المتاح',
        filter_used_short: 'مستعمل',
        btn_activate_all: 'تفعيل الكل',
        search_ph: 'بحث ذكي بالاسم، الجوال، اليوزر...',

        // Table headers - Ninja (static)
        th_ninja_data: 'بيانات الحساب',
        th_ninja_status: 'حالة الحساب',
        th_ninja_actual: 'المندوب الفعلي',
        th_ninja_contact: 'التواصل / السجل',
        th_ninja_daily: 'أداء اليوم',
        th_ninja_hours: 'ساعات العمل',
        th_ninja_total: 'التراكمي',
        th_ninja_notes: 'ملاحظات',
        th_ninja_ctrl: 'التحكم',
        // Table headers - Other platforms (static)
        th_data: 'بيانات الحساب',
        th_status_contact: 'الحالة والاتصال 📱',
        th_wallet: 'المحفظة 💰',
        th_orders: 'الطلبات (يومي/تراكمي/مرفوض)',
        th_cancel: 'الإلغاء 🚫',
        th_ontime: 'الوقت ⏱️',
        th_delay: 'التأخير ⏳',
        th_hours_total: 'إجمالي الساعات',
        th_notes: 'ملاحظات',
        th_ctrl: 'التحكم',

        // Status values (for display)
        status_available: 'متاح',
        status_in_use: 'مستعمل',
        status_suspended: 'موقوف',

        // Table cell labels (dynamic)
        lbl_daily: 'يومي',
        lbl_total: 'تراكمي',
        lbl_rejected: 'مرفوض',
        lbl_rejected_daily: 'مرفوض يومي',
        lbl_km_total: 'كم تراكمي',
        lbl_ignore_daily: 'تجاهل يومي:',
        lbl_ignore_monthly: 'تجاهل شهري:',
        lbl_fuel: 'بنزين:',
        lbl_emp_num: 'رقم الموظف:',
        lbl_history: 'السجل',
        lbl_wa_title: 'مراسلة الواتساب إلى', lbl_warn_title: 'تنبيه المقصر',
        lbl_alert_btn: 'إنذار',
        lbl_wallet_alert: 'إنذار محفظة',
        lbl_km_daily: 'كم يومي',
        ai_hero_prefix: '🔥 بطل اليوم هو',
        ai_orders_word: 'طلب',
        ai_available_prefix: '💡 يوجد',
        ai_available_suffix: 'حساب متاح للمنطقة.',
        ai_excellent: '✅ أداء ممتاز ومستقر!',

        // Finance Section
        finance_title: 'اللوحة المالية الشاملة 💰',
        finance_subtitle: 'تحليل ذكي للأيام الصالحة والغير صالحة',
        btn_export_finance: 'تصدير للإكسيل',
        btn_import_invoice: 'إدراج فاتورة',
        fin_total_drivers: 'إجمالي المناديب',
        fin_valid_days: 'الأيام الصالحة',
        fin_invalid_days: 'الأيام غير الصالحة',
        fin_total_fines: 'إجمالي الغرامات',
        fin_no_data: 'يرجى إدراج ملف الفاتورة للبدء بالتحليل',

        // Form Modal
        form_title: 'إدارة بيانات الحساب',
        form_platform: 'المنصة التشغيلية 🌐',
        plat_all: '🌐 عام', plat_ninja: '🥷 نينجا', plat_keeta: '🚴 كيتا', plat_hunger: '📦 هنقرستيشن', plat_jahez: '🛒 جاهز', plat_chefz: '👨‍🍳 ذا شفز',
        form_vehicle_type: 'نوع الحساب',
        vehicle_car: 'سيارة',
        vehicle_bike: 'دباب',
        form_transfer: 'نقل لعهدة مشرف آخر 👑',
        form_user_id: 'رقم اليوزر (ID)',
        form_owner: 'المالك الأساسي',
        form_owner_iqama: 'رقم إقامة المالك',
        form_actual: 'اسم المندوب الفعلي',
        form_actual_iqama: 'رقم إقامة المستخدم الفعلي',
        form_emp_num: 'رقم الموظف',
        form_phone: 'رقم الجوال',
        form_fuel: 'تكلفة البنزين الشهري',
        form_date: 'تاريخ الاستلام',
        form_status: 'الحالة',
        status_opt_avail: 'متاح',
        status_opt_used: 'قيد الاستخدام',
        status_opt_suspended: 'موقوف',
        form_wallet: 'المحفظة / المديونية (ريال)',
        form_rejected_total: 'الطلبات المرفوضة (تراكمي)',
        form_rejected_daily: 'الطلبات المرفوضة (يومي)',
        form_km_total: 'التراكمي الكلي للكيلو متر (كم)',
        form_ignore: 'تجاهل الطلبات',
        form_ignore_daily: 'يومي',
        form_ignore_monthly: 'شهري',
        form_hours: 'ساعات العمل ⏱️',
        form_daily_done: 'مكتمل اليوم',
        form_total_orders: 'التراكمي الكلي',
        form_notes: 'ملاحظات',
        form_cancel: 'إلغاء',
        form_save: 'حفظ التغييرات ✅',
        form_keeta_cancel: 'نسبة الإلغاء %',
        form_keeta_ontime: 'التوصيل بالوقت %',
        form_keeta_delay: 'نسبة التأخير %',
        form_planned_hours: 'الساعات المخطط لها 🗓️',
        btn_contract_bulk: 'نوع التعاقد للكل',
        contract_all_free: '🆓 الكل فري لانسر',
        contract_all_kafala: '🔗 الكل كفالة',
        form_saned_title: 'حركة ساند (جاهز)',
        form_driver_paid_saned: 'المندوب دفع لساند (ر.س)',
        form_saned_paid_driver: 'ساند دفع للمندوب (ر.س)',

        // Settings Modal
        settings_title: 'إعدادات النظام والأقفال',
        settings_dark: 'الوضع الليلي (Dark Mode) 🌙',
        settings_auto_send: 'إرسال تلقائي للمقصرين',
        settings_auto_send_desc: 'يعمل فقط عند فتح لوحة الإدارة.',
        settings_time_lbl: 'الوقت المحدد',
        settings_save_time: 'حفظ الإعداد',
        settings_locks_title: 'أقفال الأقسام (كلمات المرور للمشرفين)',
        settings_locks_desc: 'قم بتعيين كلمات مرور للأقسام لمنع تداخل العمل بين المشرفين.',
        settings_pass_ninja: 'باسوورد نينجا',
        settings_pass_keeta: 'باسوورد كيتا',
        settings_pass_hunger: 'باسوورد هنقرستيشن',
        settings_pass_jahez: 'باسوورد جاهز',
        settings_pass_chefz: 'باسوورد ذا شفز',
        settings_save_btn: 'حفظ التعديلات',

        // Admins Modal
        admins_title: 'إدارة المشرفين والصلاحيات',
        admins_ph_user: 'يوزر المشرف (مثال: ahmed)',
        admins_ph_pass: 'كلمة المرور',
        admins_ph_name: 'الاسم المعروض',
        admins_platforms_lbl: 'المنصات المسموح بالدخول إليها:',
        admins_perms_lbl: 'صلاحيات التحكم داخل المنصات:',
        admins_perm_add: 'إضافة/تعديل الحسابات',
        admins_perm_del: 'حذف المناديب للسلة 🗑️',
        admins_perm_exp: 'تصدير التقارير (Excel) 📊',
        admins_save_btn: 'حفظ بيانات وصلاحيات المشرف',
        admins_th_user: 'يوزر الدخول',
        admins_th_name: 'الاسم المعروض',
        admins_th_platforms: 'المنصات المسموحة',
        admins_th_perms: 'صلاحيات التحكم',
        admins_th_ctrl: 'تعديل / حذف',

        // History Modal
        history_title: 'السجل التاريخي لحركات الحساب',
        history_th_platform: 'المنصة',
        history_th_driver: 'المندوب',
        history_th_start: 'تاريخ الاستلام',
        history_th_end: 'تاريخ التسليم',
        history_th_wallet: 'المحفظة / المديونية',
        history_th_orders: 'أداء (مكتمل/مرفوض)',
        history_th_sup: 'المشرف',
        history_del_sel: 'حذف المحدد',
        history_del_all: 'حذف الكل',
        history_close: 'إغلاق السجل',

        // Smart Paste Modal
        smart_title: 'المحلل الذكي للنصوص',
        smart_desc: 'قم بنسخ البيانات العشوائية من لوحة الإدارة والصقها هنا، وسيقوم النظام باستخراج الهويات والأسماء آلياً.',
        smart_ph: 'الصق البيانات هنا...',
        smart_btn: 'تحليل واستيراد البيانات فوراً',

        // Reset Modal
        reset_title: 'تصفير مخصص للبيانات',
        reset_warning: 'انتبه: سيتم تطبيق هذا الإجراء على القسم المفتوح حالياً فقط.',
        reset_daily: 'تصفير طلبات اليوم والمرفوضات (0)',
        reset_total: 'تصفير الطلبات التراكمية (0)',
        reset_hours: 'تصفير ساعات العمل الكلية (0)',
        reset_btn: 'تأكيد التصفير 🗑️',

        // Defaulters Modal
        defaulters_title: 'إنذار المناديب المقصرين',
        defaulters_desc: 'يعرض هذا السجل كل مندوب يعمل حالياً في القسم وحقق شرط الإنذار: أقل من 15 طلب.',
        defaulters_send_all: 'إرسال للجميع',
        defaulters_th_name: 'اسم المندوب',
        defaulters_th_perf: 'أداء اليوم',
        defaulters_th_phone: 'رقم الجوال',
        defaulters_th_action: 'إجراء فوري',

        // Trash Modal
        trash_title: 'الأرشيف الآمن (سلة المحذوفات)',
        trash_th_platform: 'المنصة',
        trash_th_id: 'رقم اليوزر (ID)',
        trash_th_name: 'المالك / المندوب الفعلي',
        trash_th_deleted: 'تاريخ واسم حاذف الحساب',
        trash_th_restore: 'استعادة النظام ♻️',

        // Archive Modal
        archive_title: 'أرشيف الشهور والتقييم الآلي',
        archive_daily_title: 'سحب تقرير أداء يومي',
        archive_download: 'تحميل إكسيل',
        archive_lock_title: 'تقفيل وأرشفة الشهر بالكامل',
        archive_lock_desc: 'سيتم حفظ أداء جميع المناديب وتصفير العدادات لبدء شهر جديد.',
        archive_lock_btn: 'تقفيل الشهر الحالي',
        archive_select_ph: '-- استعراض الأرشيف السالف --',
        archive_search_ph: 'بحث في السجل المؤرشف...',
        archive_period_btn: 'تقرير الفترة',
        archive_close: 'إغلاق النافذة',
        archive_export_btn: 'تصدير الأرشيف المختار',
        archive_no_data: 'يرجى اختيار شهر من القائمة العلوية للعرض',

        // Fuel Modal
        fuel_title: 'تقرير استهلاك البنزين الشهري',
        fuel_platform_lbl: 'المنصة الحالية:',
        fuel_total_lbl: 'إجمالي الاستهلاك:',
        fuel_export_btn: 'تصدير البنزين',
        fuel_th_platform: 'المنصة',
        fuel_th_id: 'رقم اليوزر',
        fuel_th_driver: 'المندوب الفعلي',
        fuel_th_emp: 'رقم الموظف',
        fuel_th_sup: 'المشرف',
        fuel_th_cost: 'بنزين الشهري (ر.س)',
        fuel_close: 'إغلاق',

        // Undo Toast
        undo_label: 'إمكانية التراجع:',
        undo_unit: 'مستوى',
        undo_btn: '↩ تراجع',

        // Bulk Actions
        bulk_selected: 'محدد',
        bulk_copy: 'نسخ الأرقام',
        bulk_suspend: 'إيقاف فوري',
        bulk_transfer: 'نقل العهدة',
        bulk_delete: 'حذف الكل',
        bulk_deselect: 'إلغاء التحديد',

        // Supervisor selector
        all_supervisors: '🌐 كل المشرفين',

        // Archive table headers & labels
        arch_th_id: 'رقم اليوزر (ID)',
        arch_th_user: 'المستخدم الفعلي',
        arch_th_hours: 'إجمالي الساعات ⏱️',
        arch_th_orders: 'إجمالي الطلبات 📈',
        arch_th_rating: 'التقييم',
        arch_th_wallet: 'المحفظة 💰',
        arch_th_orders_total: 'الطلبات',
        arch_th_cancel: 'الإلغاء 🚫',
        arch_th_ontime: 'الوقت ⏱️',
        arch_th_delay: 'التأخير ⏳',
        arch_th_orders_done: 'الطلبات ✅',
        arch_th_rejected: 'المرفوضة ❌',
        lbl_completed: 'مكتمل',
        lbl_rating_excellent: 'ممتاز مكتمل الساعات',
        lbl_rating_low: 'نقص ساعات',
        lbl_hour: 'ساعة',
        lbl_order: 'طلب',
        lbl_no_archive: 'لا توجد بيانات مؤرشفة',
        arch_loading: '-- جاري تحميل الأرشيف --',
        arch_select_month: '-- اختر الشهر --',
        arch_select_prompt: 'اختر شهراً مؤرشفاً من القائمة للعرض',
        lbl_fuel_no_data: 'لا توجد بيانات وقود لهذا القسم حالياً',

        // Platform short names (for history log, defaulters, etc.)
        pname_ninja: 'نينجا',
        pname_keeta: 'كيتا',
        pname_hunger: 'هنقرستيشن',
        pname_jahez: 'جاهز',
        pname_chefz: 'ذا شفز',
        rider_profile_title: 'ملف المندوب 360°',

        // History modal
        lbl_no_history: 'لا توجد حركات سابقة',

        // Defaulters modal
        defaulters_no_today: 'لا يوجد أي مقصرين اليوم في قسم',
        defaulters_alert_btn: 'إنذار',

        // Trash modal
        trash_loading: 'جاري جلب المحذوفات من الخزنة الآمنة... ⏳',
        trash_empty: 'سلة المحذوفات فارغة تماماً، لا توجد أي داتا ضائعة.',

        // Finance modal
        finance_loading: 'جاري تحليل الفاتورة المتقدم...',

        // Supervisor dropdown
        lbl_current_custody: 'العهدة الحالية',

        // Archive select
        arch_select_view: 'اختر شهراً مؤرشفاً للعرض',

        // Sending states
        lbl_sending: 'جاري الإرسال...',
        lbl_sending_msgs: 'جاري إرسال',
        lbl_message: 'رسالة...',
        btn_auto_send_all: 'إرسال إنذار آلي للكل (API)',
        btn_restore_account: 'استرجاع الحساب',
    },

    en: {
        // System
        page_title: 'SpeedPro ERP',
        sys_subtitle: 'Enterprise Resource Planning (ERP)',
        developer: 'Developed by Magdy Saleh © 2026',
        lang_switch: 'عربي',
        // === New Sections: Home / Cars / HR ===
        tab_home: 'Home', tab_cars: 'Fleet 🚗', tab_hr: 'Platforms 👥',
        home_title: 'Main Dashboard', home_subtitle: 'Overview of all platforms and departments',
        home_chart_orders: 'Orders Comparison by Platform', home_chart_status: 'Account Status (Available / In Use)',
        home_chart_accounts: 'Account Distribution by Platform', home_supervisors: 'Supervisor Status',
        home_alerts: 'Smart Alerts', home_finance: 'Financial Summary',
        home_kpi_accounts: 'Total Accounts', home_inuse: 'In Use', home_today_orders: "Today's Orders",
        home_total_orders: 'Cumulative Orders', home_kpi_cars: 'Vehicles', home_kpi_emps: 'Employees',
        home_accounts_count: 'Account Count', home_no_supervisors: 'No supervisors found',
        home_online: 'Online', home_offline: 'Offline', role_super: 'Super Admin', role_supervisor: 'Supervisor',
        home_no_alerts: 'No alerts at this time 👌', alert_expired: 'Expired ⚠️', alert_in: 'In', alert_days: 'days',
        alert_suspended_accounts: 'Suspended accounts',
        fin_fuel_accounts: 'Account Fuel Costs', fin_fuel_cars: 'Fleet Fuel Costs', fin_violations: 'Traffic Violations',
        fin_salaries: 'Employee Salaries', fin_total_monthly: 'Estimated Monthly Total',
        currency_sar: 'SAR', unit_km: 'KM', btn_export: 'Export Excel', btn_cancel: 'Cancel', btn_save: 'Save',
        cars_title: 'Fleet Management', cars_subtitle: 'Track vehicles, documents, maintenance and violations',
        cars_tab_fleet: 'Vehicles', cars_tab_chips: 'Fuel Cards', cars_tab_accidents: 'Accidents', cars_tab_maintenance: 'Maintenance', cars_tab_handover: 'Handover', cars_tab_rental: 'Rentals',
        btn_export_short: 'Export', cars_add_vehicle: 'Add Vehicle', cars_add_chip: 'Add Card', cars_add_accident: 'Log Accident', cars_add_maint: 'Add Service', cars_add_handover: 'Handover', cars_add_rental: 'New Rental Contract',
        export_choose: 'Choose what to export', export_fleet_label: 'Fleet — Vehicle Data', export_chips_label: 'Fuel Cards', export_accidents_label: 'Accident Log', export_maint_label: 'Maintenance Log', export_handover_label: 'Handover Log', export_rental_label: 'Rental Contracts',
        rental_modal_title: 'Car Rental Contract', rental_car: 'Vehicle to Rent', rental_plate: 'Plate Number', rental_renter_name: 'Renter Name', rental_renter_id: 'ID / Iqama Number', rental_phone: 'Phone', rental_start: 'Start Date', rental_end: 'End Date', rental_daily_rate: 'Daily Rate (SAR)', rental_deposit: 'Deposit (SAR)', rental_total: 'Total (SAR)', rental_paid: 'Amount Paid (SAR)', rental_status: 'Contract Status', rental_deposit_returned: 'Deposit Returned', rental_notes: 'Notes',
        rental_th_renter: 'Renter', rental_th_car: 'Vehicle', rental_th_period: 'Rental Period', rental_th_daily: 'Daily Rate', rental_th_total: 'Total', rental_th_paid: 'Paid', rental_th_deposit: 'Deposit', rental_th_status: 'Status', rental_th_actions: 'Actions',
        export_all_label: 'Export All — Single Excel File', export_all_sub: '5 worksheets in one file',
        filter_vehicle_type: 'VEHICLE TYPE', filter_status: 'STATUS', filter_clear: 'Clear All Filters', filter_all: 'All',
        cars_add: 'Add Vehicle', cars_search_ph: 'Search by plate, type, driver...',
        cars_th_vehicle: 'Vehicle', cars_th_driver: 'Assigned Driver', cars_th_status: 'Status',
        cars_th_reg: 'Registration', cars_th_insurance: 'Insurance', cars_th_inspection: 'Inspection',
        cars_th_maint: 'Oil / Odometer', cars_th_violations: 'Violations / Fuel', cars_th_ctrl: 'Actions',
        car_modal_title: 'Vehicle Details', car_plate: 'Plate Number', car_type: 'Make / Model',
        car_model: 'Year', car_driver: 'Assigned Driver / Employee', car_status: 'Status',
        car_status_active: 'Active', car_status_maint: 'In Maintenance', car_status_stopped: 'Stopped',
        car_sec_docs: '📄 Documents & Expiry Dates', car_reg_exp: 'Registration Expiry', car_ins_exp: 'Insurance Expiry',
        car_insp_exp: 'Inspection Expiry', car_sec_maint: '🔧 Maintenance & Fuel', car_odometer: 'Odometer (KM)',
        car_last_oil: 'Last Oil Change (KM)', car_next_maint: 'Next Maintenance', car_fuel: 'Monthly Fuel Cost',
        car_violations: 'Violations Count', car_violations_cost: 'Violations Cost (SAR)', car_notes: 'Notes',
        cars_empty: 'No vehicles registered. Click "Add Vehicle" to start.', cars_violations_short: 'violation(s)',
        cars_kpi_total: 'Total Vehicles', cars_kpi_active: 'Active', cars_kpi_maint: 'In Maintenance',
        cars_kpi_expiring: 'Expiring Documents', cars_plate_required: 'Please enter the plate number',
        hr_title: 'Human Resources', hr_subtitle: 'Employee files, salaries, attendance and documents',
        hr_add: 'Add Employee', hr_search_ph: 'Search by name, employee number, job...',
        hr_th_emp: 'Employee', hr_th_id: 'ID / Iqama', hr_th_contact: 'Phone / Supervisor',
        hr_th_salary: 'Salary (Net)', hr_th_attendance: 'Attendance / Leaves', hr_th_docs: 'Documents', hr_th_ctrl: 'Actions',
        hr_modal_title: 'Employee Details', hr_sec_file: '👤 Employee File', hr_name: 'Name', hr_emp_num: 'Employee No.',
        hr_job: 'Job Title', hr_national_id: 'ID / Iqama Number', hr_phone: 'Mobile', hr_hire_date: 'Hire Date',
        hr_supervisor: 'Supervisor', hr_emp_status: 'Employment Status', hr_status_active: 'Active',
        hr_status_leave: 'On Leave', hr_status_suspended: 'Suspended', hr_sec_salary: '💰 Salary & Allowances',
        hr_basic: 'Basic Salary', hr_allowance: 'Allowances', hr_deduction: 'Deductions', hr_net: 'Net Salary',
        hr_sec_attendance: '🗓️ Attendance & Leaves', hr_leave_balance: 'Leave Balance (days)', hr_absence: 'Absence Days This Month',
        hr_sec_docs: '📄 Documents & Expiry Dates', hr_iqama_exp: 'Iqama Expiry', hr_license_exp: 'License Expiry',
        hr_contract_exp: 'Contract Expiry', hr_notes: 'Notes',
        hr_empty: 'No employees registered. Click "Add Employee" to start.', hr_leave_short: 'Leave', hr_absence_short: 'Absent',
        hr_iqama_short: 'Iqama', hr_license_short: 'License', hr_contract_short: 'Contract',
        hr_kpi_total: 'Total Employees', hr_kpi_active: 'Active', hr_kpi_leave: 'On Leave', hr_kpi_salaries: 'Total Salaries',
        hr_name_required: 'Please enter employee name', saved_success: 'Saved successfully ✅', no_data_export: 'No data to export',
        hr_modal_title: 'Work & Salary Data', hr_edit_data: 'Edit Data', hr_clear_data: 'Clear Work Data',
        confirm_delete_car: 'Are you sure you want to delete this vehicle?', confirm_delete_emp: 'Are you sure you want to delete this employee?',
        swal_notify_title: 'System Notification',
        swal_ok: 'OK',
        // Driver Docs
        hr_subtab_emp: '👥 Employee Files', hr_subtab_docs: '📄 Driver Documents',
        docs_kpi_total_drivers: 'Total Drivers', docs_kpi_expired: 'Expired Docs', docs_kpi_expiring: 'Expiring Soon',
        docs_kpi_missing: 'Not Uploaded', docs_kpi_valid: 'Valid Docs',
        docs_filter_all: 'All', docs_filter_expired: 'Expired', docs_filter_expiring: 'Expiring Soon',
        docs_filter_valid: 'Valid', docs_filter_missing: 'Not Uploaded',
        docs_th_driver: 'Driver', docs_th_iqama: 'Iqama Photo', docs_th_light_lic: 'Light Transport License',
        docs_th_moto_lic: 'Motorcycle License', docs_th_driver_card: 'Driver Card',
        docs_th_health: 'Health Certificate', docs_th_contract: 'Partnership Contract', docs_th_actions: 'Actions',
        docs_manage: 'Manage Docs', docs_not_uploaded: 'Not Uploaded', docs_uploaded_no_date: 'Uploaded',
        docs_valid: 'Valid', docs_no_drivers: 'No drivers registered.', docs_no_match_filter: 'No results for this filter.',
        docs_view: 'Preview', docs_no_file_yet: 'No file uploaded yet',
        docs_expiry_date: 'Expiry Date', docs_save_date: 'Save Date', docs_upload_file: 'Upload File',
        docs_upload_btn: 'Upload File', docs_replace_file: 'Replace File', docs_last_upload: 'Last Uploaded',
        docs_file_too_large: 'File is too large. Maximum size is 10 MB.',
        docs_upload_error: 'Error uploading file', docs_search_ph: 'Search driver...',
        docs_modal_title: 'Driver Documents', docs_viewer_title: 'Document Preview',
        docs_select_all: 'Select All', docs_delete_selected: 'Delete Selected',
        docs_none_selected: 'No drivers selected.', docs_confirm_delete_selected: 'Delete all documents for these drivers?',
        docs_download: 'Download File', docs_download_all: 'Download All Docs (ZIP)',
        docs_download_zip: 'Download ZIP', docs_downloading: 'Downloading...',
        docs_no_files_to_download: 'No uploaded files found for this driver.',
        docs_download_error: 'Error downloading files',

        // Login
        username_label: 'Username',
        password_label: 'Password',
        remember_me: 'Remember me',
        login_btn: 'Login',

        // Nav Tabs
        tab_ninja: 'Ninja Platform',
        tab_keeta: 'Keeta Platform',
        tab_hunger: 'HungerStation',
        tab_jahez: 'Jahez Platform',
        tab_chefz: 'The Chefz',
        platforms_delivery: 'Delivery Platforms',
        tab_finance: 'Finance 💰',

        // Sidebar
        sidebar_title: 'Admin Center',
        section_settings: 'System Settings',
        section_ops: 'Operations',
        section_data: 'Data Management',
        btn_locks: 'Section Locks',
        btn_admins: 'Manage Admins',
        btn_defaulters: 'Defaulters Alert 🚨',
        btn_archive: 'Monthly Archive',
        btn_fuel_modal: 'Fuel Costs',
        btn_trash: 'Trash',
        btn_dark: 'Dark Mode',
        btn_import_fuel: 'Import Fuel Costs',
        btn_backup: 'Backup',
        btn_driver_template: 'User Template',
        btn_perf_template: 'Performance Template',
        btn_add_manual: 'Manual Add',
        btn_smart_paste: 'Smart Paste',
        btn_import_drivers: 'Import Drivers',
        btn_import_perf: 'Import Performance',
        btn_late_report: 'Late Daily Report',
        btn_fix_dup: 'Fix Duplicates',
        btn_set_dates: 'Set Dispatch Date to 1st of Month',
        btn_reset: 'Custom Reset',
        btn_logout: 'Logout',
        btn_sys_tools: 'System Tools',

        // Platform Banners
        ops_platform: 'Operations Platform',
        banner_ninja: 'Ninja Management 🥷',
        banner_keeta: 'Keeta Management 🚴',
        banner_hunger: 'HungerStation Management 📦',
        banner_jahez: 'Jahez Management 🛒',
        banner_chefz: 'The Chefz Management 👨‍🍳',

        // AI Radar
        ai_radar: 'AI Radar',
        ai_loading: 'Analyzing data...',

        // Stats - Ninja
        stat_total_ninja: 'Total Accounts',
        stat_avail_ninja: 'Available',
        stat_used_ninja: 'In Use',
        stat_orders_ninja: 'Total Orders',
        // Stats - Keeta
        stat_total_keeta: 'Total Keeta',
        stat_avail_keeta: 'Available',
        stat_used_keeta: 'In Use',
        stat_orders_keeta: 'Total Orders',
        // Stats - Hunger
        stat_total_hunger: 'Total HungerStation',
        stat_avail_hunger: 'Available',
        stat_used_hunger: 'In Use',
        stat_orders_hunger: 'Total Orders',
        // Stats - Jahez
        stat_total_jahez: 'Total Jahez',
        stat_avail_jahez: 'Available',
        stat_used_jahez: 'In Use',
        stat_orders_jahez: 'Total Orders',
        // Stats - Chefz
        stat_total_chefz: 'Total The Chefz',
        stat_avail_chefz: 'Available',
        stat_used_chefz: 'In Use',
        stat_orders_chefz: 'Total Orders',

        // Filters
        filter_all: 'Show All',
        filter_avail: 'Available Only',
        filter_used: 'In Use',
        filter_all_short: 'All',
        filter_avail_short: 'Available',
        filter_used_short: 'In Use',
        btn_activate_all: 'Activate All',
        search_ph: 'Smart search by name, phone, ID...',

        // Table headers - Ninja (static)
        th_ninja_data: 'Account Data',
        th_ninja_status: 'Account Status',
        th_ninja_actual: 'Actual Driver',
        th_ninja_contact: 'Contact / Log',
        th_ninja_daily: "Today's Performance",
        th_ninja_hours: 'Work Hours',
        th_ninja_total: 'Cumulative',
        th_ninja_notes: 'Notes',
        th_ninja_ctrl: 'Actions',
        // Table headers - Other platforms (static)
        th_data: 'Account Data',
        th_status_contact: 'Status & Contact 📱',
        th_wallet: 'Wallet 💰',
        th_orders: 'Orders (Daily/Total/Rejected)',
        th_cancel: 'Cancel Rate 🚫',
        th_ontime: 'On Time ⏱️',
        th_delay: 'Delay ⏳',
        th_hours_total: 'Total Hours',
        th_notes: 'Notes',
        th_ctrl: 'Actions',

        // Status values (for display)
        status_available: 'Available',
        status_in_use: 'In Use',
        status_suspended: 'Suspended',

        // Table cell labels (dynamic)
        lbl_daily: 'Daily',
        lbl_total: 'Total',
        lbl_rejected: 'Rejected',
        lbl_rejected_daily: 'Rej. Daily',
        lbl_km_total: 'KM Total',
        lbl_ignore_daily: 'Ignored Daily:',
        lbl_ignore_monthly: 'Ignored Monthly:',
        lbl_fuel: 'Fuel:',
        lbl_emp_num: 'Emp No:',
        lbl_history: 'Log',
        lbl_wa_title: 'WhatsApp message to', lbl_warn_title: 'Warn underperformer',
        lbl_alert_btn: 'Alert',
        lbl_wallet_alert: 'Wallet Alert',
        lbl_km_daily: 'KM Daily',
        ai_hero_prefix: '🔥 Today\'s hero is',
        ai_orders_word: 'orders',
        ai_available_prefix: '💡',
        ai_available_suffix: 'available accounts in the area.',
        ai_excellent: '✅ Excellent & stable performance!',

        // Finance Section
        finance_title: 'Comprehensive Finance Dashboard 💰',
        finance_subtitle: 'Smart analysis of valid and invalid days',
        btn_export_finance: 'Export to Excel',
        btn_import_invoice: 'Import Invoice',
        fin_total_drivers: 'Total Drivers',
        fin_valid_days: 'Valid Days',
        fin_invalid_days: 'Invalid Days',
        fin_total_fines: 'Total Fines',
        fin_no_data: 'Please import an invoice file to start the analysis',

        // Form Modal
        form_title: 'Account Data Management',
        form_platform: 'Operations Platform 🌐',
        plat_all: '🌐 General', plat_ninja: '🥷 Ninja', plat_keeta: '🚴 Keeta', plat_hunger: '📦 HungerStation', plat_jahez: '🛒 Jahez', plat_chefz: '👨‍🍳 The Chefz',
        form_vehicle_type: 'Account Type',
        vehicle_car: 'Car',
        vehicle_bike: 'Motorcycle',
        form_transfer: 'Transfer to Another Supervisor 👑',
        form_user_id: 'User ID',
        form_owner: 'Primary Owner',
        form_owner_iqama: 'Owner Iqama No.',
        form_actual: 'Actual Driver Name',
        form_actual_iqama: 'Actual User Iqama No.',
        form_emp_num: 'Employee Number',
        form_phone: 'Phone Number',
        form_fuel: 'Monthly Fuel Cost',
        form_date: 'Dispatch Date',
        form_status: 'Status',
        status_opt_avail: 'Available',
        status_opt_used: 'In Use',
        status_opt_suspended: 'Suspended',
        form_wallet: 'Wallet / Debt (SAR)',
        form_rejected_total: 'Rejected Orders (Total)',
        form_rejected_daily: 'Rejected Orders (Daily)',
        form_km_total: 'Total KM Cumulative',
        form_ignore: 'Ignored Orders',
        form_ignore_daily: 'Daily',
        form_ignore_monthly: 'Monthly',
        form_hours: 'Work Hours ⏱️',
        form_daily_done: 'Completed Today',
        form_total_orders: 'Total Cumulative',
        form_notes: 'Notes',
        form_cancel: 'Cancel',
        form_save: 'Save Changes ✅',
        form_keeta_cancel: 'Cancel Rate %',
        form_keeta_ontime: 'On-Time Delivery %',
        form_keeta_delay: 'Delay Rate %',
        form_planned_hours: 'Planned Hours 🗓️',
        btn_contract_bulk: 'Bulk contract type',
        contract_all_free: '🆓 All Freelancer',
        contract_all_kafala: '🔗 All Sponsored',
        form_saned_title: 'Saned movement (Jahez)',
        form_driver_paid_saned: 'Driver Paid Saned (SAR)',
        form_saned_paid_driver: 'Saned Paid Driver (SAR)',

        // Settings Modal
        settings_title: 'System Settings & Locks',
        settings_dark: 'Dark Mode 🌙',
        settings_auto_send: 'Auto Send to Defaulters',
        settings_auto_send_desc: 'Works only when the admin panel is open.',
        settings_time_lbl: 'Scheduled Time',
        settings_save_time: 'Save Setting',
        settings_locks_title: 'Section Locks (Supervisor Passwords)',
        settings_locks_desc: 'Set passwords for sections to prevent overlap between supervisors.',
        settings_pass_ninja: 'Ninja Password',
        settings_pass_keeta: 'Keeta Password',
        settings_pass_hunger: 'HungerStation Password',
        settings_pass_jahez: 'Jahez Password',
        settings_pass_chefz: 'The Chefz Password',
        settings_save_btn: 'Save Changes',

        // Admins Modal
        admins_title: 'Manage Admins & Permissions',
        admins_ph_user: 'Admin username (e.g. ahmed)',
        admins_ph_pass: 'Password',
        admins_ph_name: 'Display Name',
        admins_platforms_lbl: 'Allowed Platforms:',
        admins_perms_lbl: 'Control Permissions within Platforms:',
        admins_perm_add: 'Add/Edit Accounts',
        admins_perm_del: 'Delete Drivers to Trash 🗑️',
        admins_perm_exp: 'Export Reports (Excel) 📊',
        admins_save_btn: 'Save Admin Data & Permissions',
        admins_th_user: 'Login Username',
        admins_th_name: 'Display Name',
        admins_th_platforms: 'Allowed Platforms',
        admins_th_perms: 'Permissions',
        admins_th_ctrl: 'Edit / Delete',

        // History Modal
        history_title: 'Account Movement History',
        history_th_platform: 'Platform',
        history_th_driver: 'Driver',
        history_th_start: 'Dispatch Date',
        history_th_end: 'Return Date',
        history_th_wallet: 'Wallet / Debt',
        history_th_orders: 'Performance (Done/Rejected)',
        history_th_sup: 'Supervisor',
        history_del_sel: 'Delete Selected',
        history_del_all: 'Delete All',
        history_close: 'Close Log',

        // Smart Paste Modal
        smart_title: 'Smart Text Analyzer',
        smart_desc: 'Copy random data from the admin panel and paste it here. The system will automatically extract IDs and names.',
        smart_ph: 'Paste data here...',
        smart_btn: 'Analyze & Import Data Instantly',

        // Reset Modal
        reset_title: 'Custom Data Reset',
        reset_warning: 'Warning: This action applies only to the currently open section.',
        reset_daily: "Reset Today's Orders & Rejections (0)",
        reset_total: 'Reset Cumulative Orders (0)',
        reset_hours: 'Reset Total Work Hours (0)',
        reset_btn: 'Confirm Reset 🗑️',

        // Defaulters Modal
        defaulters_title: 'Defaulters Alert',
        defaulters_desc: 'Shows every driver currently working who meets the alert condition: less than 15 orders.',
        defaulters_send_all: 'Send to All',
        defaulters_th_name: 'Driver Name',
        defaulters_th_perf: "Today's Performance",
        defaulters_th_phone: 'Phone Number',
        defaulters_th_action: 'Immediate Action',

        // Trash Modal
        trash_title: 'Safe Archive (Trash)',
        trash_th_platform: 'Platform',
        trash_th_id: 'User ID',
        trash_th_name: 'Owner / Actual Driver',
        trash_th_deleted: 'Deletion Date & Deleted By',
        trash_th_restore: 'Restore ♻️',

        // Archive Modal
        archive_title: 'Monthly Archive & Auto Evaluation',
        archive_daily_title: 'Pull Daily Performance Report',
        archive_download: 'Download Excel',
        archive_lock_title: 'Lock & Archive Entire Month',
        archive_lock_desc: "All drivers' performance will be saved and counters reset for the new month.",
        archive_lock_btn: 'Lock Current Month',
        archive_select_ph: '-- Browse Previous Archive --',
        archive_search_ph: 'Search in archived records...',
        archive_period_btn: 'Period Report',
        archive_close: 'Close Window',
        archive_export_btn: 'Export Selected Archive',
        archive_no_data: 'Select a month from the list above to view',

        // Fuel Modal
        fuel_title: 'Monthly Fuel Consumption Report',
        fuel_platform_lbl: 'Current Platform:',
        fuel_total_lbl: 'Total Consumption:',
        fuel_export_btn: 'Export Fuel Report',
        fuel_th_platform: 'Platform',
        fuel_th_id: 'User ID',
        fuel_th_driver: 'Actual Driver',
        fuel_th_emp: 'Employee No.',
        fuel_th_sup: 'Supervisor',
        fuel_th_cost: 'Monthly Fuel (SAR)',
        fuel_close: 'Close',

        // Undo Toast
        undo_label: 'Undo levels:',
        undo_unit: 'level',
        undo_btn: '↩ Undo',

        // Bulk Actions
        bulk_selected: 'selected',
        bulk_copy: 'Copy Numbers',
        bulk_suspend: 'Suspend Now',
        bulk_transfer: 'Transfer',
        bulk_delete: 'Delete All',
        bulk_deselect: 'Cancel Selection',

        // Supervisor selector
        all_supervisors: '🌐 All Supervisors',

        // Archive table headers & labels
        arch_th_id: 'User ID',
        arch_th_user: 'Actual User',
        arch_th_hours: 'Total Hours ⏱️',
        arch_th_orders: 'Total Orders 📈',
        arch_th_rating: 'Rating',
        arch_th_wallet: 'Wallet 💰',
        arch_th_orders_total: 'Orders',
        arch_th_cancel: 'Cancel Rate 🚫',
        arch_th_ontime: 'On-Time ⏱️',
        arch_th_delay: 'Delay ⏳',
        arch_th_orders_done: 'Orders ✅',
        arch_th_rejected: 'Rejected ❌',
        lbl_completed: 'completed',
        lbl_rating_excellent: 'Excellent — Full Hours',
        lbl_rating_low: 'Low Hours',
        lbl_hour: 'hr',
        lbl_order: 'orders',
        lbl_no_archive: 'No archived data available',
        arch_loading: '-- Loading Archive --',
        arch_select_month: '-- Select Month --',
        arch_select_prompt: 'Select an archived month from the list above to view',
        lbl_fuel_no_data: 'No fuel data available for this section',

        // Platform short names
        pname_ninja: 'Ninja',
        pname_keeta: 'Keeta',
        pname_hunger: 'HungerStation',
        pname_jahez: 'Jahez',
        pname_chefz: 'The Chefz',
        rider_profile_title: 'Rider 360° Profile',

        // History modal
        lbl_no_history: 'No previous movements',

        // Defaulters modal
        defaulters_no_today: 'No defaulters today in section',
        defaulters_alert_btn: 'Alert',

        // Trash modal
        trash_loading: 'Loading deleted accounts from secure vault... ⏳',
        trash_empty: 'Trash is completely empty — no missing data.',

        // Finance modal
        finance_loading: 'Running advanced invoice analysis...',

        // Supervisor dropdown
        lbl_current_custody: 'current custodian',

        // Archive select
        arch_select_view: 'Select an archived month to view',

        // Sending states
        lbl_sending: 'Sending...',
        lbl_sending_msgs: 'Sending',
        lbl_message: 'messages...',
        btn_auto_send_all: 'Send Auto Alert to All (API)',
        btn_restore_account: 'Restore Account',
    }
};

// ==========================================
// Language Helper Functions
// ==========================================

let currentLang = localStorage.getItem('app_lang') || 'ar';

function t(key) {
    return (translations[currentLang] && translations[currentLang][key] !== undefined)
        ? translations[currentLang][key]
        : (translations['ar'][key] !== undefined ? translations['ar'][key] : key);
}

function toggleLanguage() {
    setLanguage(currentLang === 'ar' ? 'en' : 'ar');
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('app_lang', lang);

    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('page_title');

    // Keep the Admin Center sidebar opening from the same side as the System Tools button (right side).
    // RTL: offcanvas-start = right | LTR: offcanvas-end = right
    let _sidebar = document.getElementById('actionSidebar');
    if (_sidebar) {
        _sidebar.classList.toggle('offcanvas-end', lang === 'en');
        _sidebar.classList.toggle('offcanvas-start', lang !== 'en');
    }

    // Update all static text nodes
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });

    // Update language toggle buttons text (keep the globe icon)
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.innerHTML = '<i class="bi bi-globe2 me-1"></i>' + t('lang_switch');
    });

    // Update platform nav dropdown label
    let _pdLabel = document.getElementById('platformsNavLabel');
    if (_pdLabel) {
        const _platNames = {
            orders: L('نينجا 🥷','Ninja 🥷'), keeta: L('كيتا 🚴','Keeta 🚴'),
            hunger: L('هنقر 📦','Hunger 📦'), jahez: L('جاهز 🛍️','Jahez 🛍️'),
            chefz:  L('شفز 🍔','Chefz 🍔')
        };
        let _tab = typeof currentPlatformTab !== 'undefined' ? currentPlatformTab : null;
        _pdLabel.textContent = (_tab && _platNames[_tab]) ? _platNames[_tab] : L('المنصات','Platforms');
    }

    // Update Swal alert language
    if (typeof window._updateSwalLang === 'function') window._updateSwalLang();

    // Update Arabic/English month badges in platform banners
    if (typeof updateMonthBadges === 'function') updateMonthBadges();

    // Re-render dynamic content when logged in
    if (window.loggedInUser) {
        let tab = (typeof currentPlatformTab !== 'undefined') ? currentPlatformTab : null;
        if (tab === 'home' && typeof renderHome === 'function') renderHome();
        else if (tab === 'cars' && typeof renderCarsTable === 'function') renderCarsTable();
        else if (tab === 'hr' && typeof renderHrTable === 'function') renderHrTable();
        else if (typeof applyDataView === 'function') applyDataView();
    }

    // Automatic dictionary-based translation for everything not covered by data-i18n / L()
    if (typeof autoTranslatePage === 'function') autoTranslatePage(lang);
}

// Apply language on page load
document.addEventListener('DOMContentLoaded', function() {
    if (currentLang !== 'ar') {
        // Re-apply to ensure DOM is ready
        setLanguage(currentLang);
    }
});

// ==========================================
// Central message translation layer (alert / confirm popups)
// Translates hardcoded Arabic runtime messages to English when currentLang === 'en'
// ==========================================
const MSG_EXACT = {
    'لا يوجد إجراء يمكن التراجع عنه حالياً.': 'No action available to undo right now.',
    'حدث خطأ أثناء التراجع ❌': 'An error occurred while undoing ❌',
    'تم إقفال الجلسة آلياً لعدم النشاط (15 دقيقة) لحماية البيانات 🔒. يرجى تسجيل الدخول مجدداً.': 'Session locked automatically due to inactivity (15 minutes) to protect data 🔒. Please log in again.',
    'تم حفظ ضبط الإرسال التلقائي وتم إيقافه.': 'Auto-send setting saved and disabled.',
    'غير مصرح لك ❌ — تواصل مع الأدمن لمنح صلاحية عرض السجل': 'Not authorized ❌ — contact the admin to grant log-view permission',
    'لا يوجد سجلات أمنية بعد.': 'No security logs yet.',
    'بيانات الدخول غير صحيحة ❌': 'Invalid login credentials ❌',
    '❌ ليس لديك صلاحية الدخول لقسم السيارات. تواصل مع الأدمن.': "❌ You don't have permission to access the Fleet section. Contact the admin.",
    '❌ ليس لديك صلاحية الدخول لقسم منصات. تواصل مع الأدمن.': "❌ You don't have permission to access the HR section. Contact the admin.",
    '❌ ليس لديك صلاحية الدخول للوحة المالية. تواصل مع الأدمن.': "❌ You don't have permission to access the Finance dashboard. Contact the admin.",
    '❌ ليس لديك صلاحية الدخول لقسم السكن. تواصل مع الأدمن.': "❌ You don't have permission to access the Housing section. Contact the admin.",
    '🔒 هذا القسم مغلق ولم تقم الإدارة بتعيين كلمة مرور له بعد.': "🔒 This section is locked and management hasn't set a password for it yet.",
    'تم فتح القسم بنجاح 🎉': 'Section unlocked successfully 🎉',
    'كلمة المرور غير صحيحة ❌': 'Incorrect password ❌',
    'لم يتم العثور على أرقام جوالات صالحة للحسابات المحددة ❌': 'No valid phone numbers found for the selected accounts ❌',
    '❌ عذراً، خاصية نقل العهدة متاحة للإدارة فقط.': '❌ Sorry, the custody transfer feature is available to management only.',
    '❌ عذراً، خاصية حذف الكل متاحة فقط لمدير النظام.': '❌ Sorry, the delete-all feature is available to the system admin only.',
    'الرجاء اختيار حساب واحد على الأقل لحذفها.': 'Please select at least one account to delete.',
    'حدث خطأ أثناء الحذف الجماعي، حاول مرة أخرى.': 'An error occurred during bulk deletion, please try again.',
    '❌ ليس لديك صلاحية الحذف. تواصل مع الأدمن.': "❌ You don't have delete permission. Contact the admin.",
    'هل أنت متأكد من حذف هذا المندوب؟ سيتم نقله لسلة المحذوفات 🗑️': 'Are you sure you want to delete this rider? It will be moved to the trash 🗑️',
    'تم نقل المندوب لسلة المحذوفات بنجاح! ✅': 'Rider moved to trash successfully! ✅',
    'تم استيراد قائمة المستخدمين بنجاح! 🎉': 'User list imported successfully! 🎉',
    'حدث خطأ أثناء قراءة الملف ❌': 'An error occurred while reading the file ❌',
    'لا توجد بيانات بنزين لتصديرها لهذا القسم.': 'No fuel data to export for this section.',
    'تم تصدير تقرير البنزين بنجاح!': 'Fuel report exported successfully!',
    'الرجاء اختيار تاريخ البداية والنهاية!': 'Please select the start and end dates!',
    'يجب أن يكون تاريخ البداية قبل تاريخ النهاية!': 'The start date must be before the end date!',
    'لا توجد سجلات في الفترة المحددة لهذا القسم.': 'No records in the selected period for this section.',
    'تم استخراج تقرير الفترة بنجاح!': 'Period report exported successfully!',
    'لا توجد بيانات للقسم الحالي لتقفيلها!': 'No data in the current section to close out!',
    'تم التقفيل وأرشفة بيانات القسم بنجاح وتصفير العدادات! 🎉': 'Section data closed and archived successfully, and counters reset! 🎉',
    'برجاء اختيار التاريخ المراد سحب التقرير له!': 'Please select the date to pull the report for!',
    'لا توجد حسابات مسجلة في هذا القسم!': 'No accounts registered in this section!',
    'برجاء اختيار شهر مؤرشف أولاً لتصديره!': 'Please select an archived month first to export it!',
    '❌ ليس لديك صلاحية إضافة حسابات. تواصل مع الأدمن.': "❌ You don't have permission to add accounts. Contact the admin.",
    'الرجاء إدخال رقم اليوزر!': 'Please enter the user ID!',
    'تم حفظ البيانات بنجاح ✅': 'Data saved successfully ✅',
    'رقم الجوال غير صحيح ❌': 'Invalid phone number ❌',
    '❌ لم يتم تفعيل الـ API بعد. يرجى وضع مفاتيح UltraMsg في ملف app.js': "❌ The API isn't activated yet. Please add your UltraMsg keys in app.js",
    'لا يوجد مندوبين مقصرين لإرسال الرسالة لهم حالياً.': 'No underperforming riders to message right now.',
    'حدث خطأ أثناء الإرسال الجماعي. الرجاء المحاولة مرة أخرى.': 'An error occurred during bulk sending. Please try again.',
    'لم يتم العثور على المندوب ❌': 'Rider not found ❌',
    'تم حفظ وتأمين كلمات المرور بنجاح! 🔒': 'Passwords saved and secured successfully! 🔒',
    'الرجاء تعبئة بيانات الدخول والاسم!': 'Please fill in the login details and name!',
    'يجب السماح للمشرف بدخول منصة واحدة على الأقل!': 'The supervisor must be allowed access to at least one platform!',
    'تم إضافة المشرف الجديد بنجاح! ✅': 'New supervisor added successfully! ✅',
    'تم الحذف بنجاح!': 'Deleted successfully!',
    'لا توجد بيانات للقسم الحالي لتصديرها!': 'No data in the current section to export!',
    '❌ ليس لديك صلاحية التصفير. تواصل مع الأدمن.': "❌ You don't have reset permission. Contact the admin.",
    'تأكيد التصفير المخصص للقسم المفتوح حالياً؟': 'Confirm custom reset for the currently open section?',
    'تم تنفيذ التصفير المخصص للقسم بنجاح ✅': 'Custom reset for the section completed successfully ✅',
    'لم يتم العثور على أي بيانات بنزين صحيحة في الملف!': 'No valid fuel data found in the file!',
    '❌ حدث خطأ أثناء حفظ البيانات في قاعدة البيانات': '❌ An error occurred while saving data to the database',
    '❌ حدث خطأ أثناء قراءة الملف، تأكد من أنه ملف Excel صحيح': "❌ An error occurred while reading the file, make sure it's a valid Excel file",
    'تأكيد ترحيل التواريخ للقسم المفتوح؟ (تصفير طلبات اليوم وتحديث تاريخ الاستلام)': "Confirm date rollover for the open section? (reset today's orders and update receipt date)",
    'تم ترحيل التواريخ وتصفير الطلبات اليومية بنجاح 📆': 'Dates rolled over and daily orders reset successfully 📆',
    'لم يتم تحديث أي حساب.': 'No account was updated.',
    'رقم الجوال غير مسجل ❌': 'Phone number not registered ❌',
    '❌ ليس لديك صلاحية الوصول لسلة المحذوفات. تواصل مع الأدمن.': "❌ You don't have permission to access the trash. Contact the admin.",
    'هل تريد إعادة الحساب للوحة النشطة؟ ♻️': 'Restore the account to the active board? ♻️',
    'تم استرجاع الحساب بنجاح!': 'Account restored successfully!',
    '❌ ليس لديك صلاحية إدراج فاتورة نينجا. تواصل مع الأدمن.': "❌ You don't have permission to insert a Ninja invoice. Contact the admin.",
    'الملف فارغ.': 'The file is empty.',
    'تم تجميع وتحليل فاتورة النظام بنجاح! 📊': 'System invoice compiled and analyzed successfully! 📊',
    'هل أنت متأكد من إرسال إنذارات آلية في الخلفية لجميع المقصرين في هذا القسم؟': 'Are you sure you want to send automatic background warnings to all underperformers in this section?',
    'لا يوجد مقصرين لإرسال إنذارات لهم اليوم! 🎉': 'No underperformers to send warnings to today! 🎉',
    'رقم الجوال غير متوفر': 'Phone number not available',
    'هل تريد إزالة إنذار المحفظة لهذا الحساب وحل الحالة؟': 'Remove the wallet alert for this account and resolve the case?',
    'تم حل إنذار المحفظة بنجاح': 'Wallet alert resolved successfully',
    'حدث خطأ أثناء الحل': 'An error occurred while resolving',
    'حدث خطأ أثناء البحث عن الإنذارات': 'An error occurred while searching for alerts',
    'لم يتم العثور على الحساب المطلوب': 'The requested account was not found',
    'رقم الجوال غير موجود': 'Phone number not found',
    'تم إرسال رسالة الإنذار عبر واتساب وتسجيلها في النظام.': 'The warning message was sent via WhatsApp and logged in the system.',
    'حدث خطأ أثناء تسجيل الإنذار': 'An error occurred while logging the warning',
    '❌ ليس لديك صلاحية تعديل السيارات. تواصل مع الأدمن.': "❌ You don't have permission to edit vehicles. Contact the admin.",
    'خطأ في الحفظ': 'Save error',
    '❌ ليس لديك صلاحية حذف السيارات. تواصل مع الأدمن.': "❌ You don't have permission to delete vehicles. Contact the admin.",
    '❌ ليس لديك صلاحية إدارة السيارات. تواصل مع الأدمن.': "❌ You don't have permission to manage vehicles. Contact the admin.",
    'الرجاء إدخال اسم حامل الشريحة': "Please enter the SIM holder's name",
    '✅ تم حفظ الشريحة بنجاح': '✅ SIM saved successfully',
    '❌ ليس لديك صلاحية. تواصل مع الأدمن.': "❌ You don't have permission. Contact the admin.",
    'لا توجد بيانات للتصدير': 'No data to export',
    'هل تريد حذف هذه الحادثة؟': 'Delete this accident?',
    'هل تريد حذف سجل الصيانة هذا؟': 'Delete this maintenance record?',
    'لا توجد صور لهذه العملية.': 'No photos for this operation.',
    'هل تريد حذف هذه العملية وجميع صورها؟': 'Delete this operation and all its photos?',
    'الرجاء إدخال اسم المجمع': 'Please enter the compound name',
    '✅ تم حفظ الوحدة بنجاح': '✅ Unit saved successfully',
    '❌ ليس لديك صلاحية.': "❌ You don't have permission.",
    'الرجاء اختيار مندوب': 'Please select a rider',
    'الرجاء اختيار وحدة': 'Please select a unit',
    '✅ تم حفظ الساكن': '✅ Resident saved',
    'حذف هذا الساكن؟': 'Delete this resident?',
    'الرجاء تحديد الشهر': 'Please specify the month',
    '✅ تم تسجيل الدفعة': '✅ Payment recorded',
    'حذف هذه الدفعة؟': 'Delete this payment?',
    'لا توجد بيانات': 'No data',
    'الرجاء اختيار الوحدة السكنية': 'Please select the housing unit',
    'الرجاء كتابة وصف العطل': 'Please write the issue description',
    '✅ تم حفظ طلب الصيانة': '✅ Maintenance request saved',
    'الرجاء إدخال اسم الصنف': 'Please enter the item name',
    '✅ تم حفظ الصنف': '✅ Item saved',
    'حذف هذا الصنف من المستودع؟': 'Delete this item from the warehouse?',
    '❌ ليس لديك صلاحية تعديل قسم منصات. تواصل مع الأدمن.': "❌ You don't have permission to edit the HR section. Contact the admin.",
    '❌ ليس لديك صلاحية إدراج الفاتورة.': "❌ You don't have permission to insert the invoice.",
    '⚠️ لم يتم العثور على قيمة رقمية في الملف — أدخل الإجمالي يدوياً': '⚠️ No numeric value found in the file — enter the total manually',
    '❌ خطأ في قراءة الملف': '❌ Error reading the file',
    '❌ ليس لديك صلاحية حفظ الفواتير. تواصل مع الأدمن.': "❌ You don't have permission to save invoices. Contact the admin.",
    'الرجاء إدخال مبلغ صحيح': 'Please enter a valid amount',
    '❌ ليس لديك صلاحية حذف الفواتير. تواصل مع الأدمن.': "❌ You don't have permission to delete invoices. Contact the admin.",
    '❌ ليس لديك صلاحية إضافة معاملات. تواصل مع الأدمن.': "❌ You don't have permission to add transactions. Contact the admin.",
    '❌ ليس لديك صلاحية حذف المعاملات. تواصل مع الأدمن.': "❌ You don't have permission to delete transactions. Contact the admin.",
    'حذف هذه المعاملة؟': 'Delete this transaction?',
    '❌ ليس لديك صلاحية حفظ الأرشيف. تواصل مع الأدمن.': "❌ You don't have permission to save the archive. Contact the admin.",
    '❌ ليس لديك صلاحية حذف الأرشيف. تواصل مع الأدمن.': "❌ You don't have permission to delete the archive. Contact the admin.",
    'حذف هذا الشهر من الأرشيف؟': 'Delete this month from the archive?',
    '❌ ليس لديك صلاحية إرسال الإنذارات. تواصل مع الأدمن.': "❌ You don't have permission to send alerts. Contact the admin."
};

const MSG_PATTERNS = [
    [/^تم حفظ ضبط الإرسال التلقائي ليعمل عند (.+)\.$/, 'Auto-send setting saved to run at $1.'],
    [/^هل تريد إيقاف (\d+) حساب فوراً؟$/, 'Stop $1 account(s) immediately?'],
    [/^تم إيقاف (\d+) حساب بنجاح ✅$/, '$1 account(s) stopped successfully ✅'],
    [/^تم نسخ أرقام \((\d+)\) مندوب بنجاح! يمكنك لصقها في أداة الإرسال الجماعي 🎉$/, 'Copied $1 rider number(s) successfully! You can paste them into the bulk-send tool 🎉'],
    [/^تم نقل \((\d+)\) حساب للمشرف الجديد على منصة \((.+?)\) بنجاح! 🎉$/, 'Moved $1 account(s) to the new supervisor on platform ($2) successfully! 🎉'],
    [/^هل أنت متأكد من حذف (\d+) حساباً ونقله إلى سلة المحذوفات؟$/, 'Are you sure you want to delete $1 account(s) and move them to the trash?'],
    [/^تم حذف (\d+) حساب ونقلها إلى سلة المحذوفات بنجاح ✅$/, 'Deleted $1 account(s) and moved them to the trash successfully ✅'],
    [/^تم تحليل وتحديث أداء (\d+) حساب بنجاح! 🎉$/, 'Analyzed and updated performance for $1 account(s) successfully! 🎉'],
    [/^تم استخراج شيت التتبع اليومي لقسم (.+?) بنجاح! 🎉$/, 'Daily tracking sheet for the $1 section exported successfully! 🎉'],
    [/^لا يوجد أرقام جوال سعودية صالحة للمقصرين\.\nعدد المقصرين: (\d+)، الأرقام الصالحة: 0$/, 'No valid Saudi phone numbers for underperformers.\nUnderperformers: $1, valid numbers: 0'],
    [/^هل أنت متأكد من حذف المشرف \((.+?)\) نهائياً؟$/, 'Are you sure you want to permanently delete supervisor ($1)?'],
    [/^تم تحليل وإدراج (\d+) بيانات بنجاح ⚡$/, 'Analyzed and inserted $1 record(s) successfully ⚡'],
    [/^✅ تم تحديث تكاليف البنزين لـ \((\d+)\) حساب بنجاح!\n⚠️ (\d+) سجل لم يتم تطابقه مع الحسابات الحالية\.$/, "✅ Fuel costs updated for $1 account(s) successfully!\n⚠️ $2 record(s) didn't match current accounts."],
    [/^✅ تم تحديث تكاليف البنزين لـ \((\d+)\) حساب بنجاح!$/, '✅ Fuel costs updated for $1 account(s) successfully!'],
    [/^لا توجد حسابات متاحة في (.+?) لتفعيلها\.$/, 'No available accounts in $1 to activate.'],
    [/^✅ تمت العملية! تم إرسال \((\d+)\) رسالة بنجاح\.$/, '✅ Done! Sent $1 message(s) successfully.'],
    [/^حذف شريحة "(.*?)"؟$/, 'Delete SIM "$1"?'],
    [/^حذف وحدة "(.*?)"؟$/, 'Delete unit "$1"?'],
    [/^حذف طلب صيانة "(.*?)"؟$/, 'Delete maintenance request "$1"?'],
    [/^هل تريد مسح بيانات العمل والراتب لـ "(.*?)"؟$/, 'Clear work and salary data for "$1"?'],
    [/^حذف فاتورة (.+?) من (.+?)؟$/, 'Delete invoice $1 from $2?'],
    [/^✅ تم حفظ ملخص (.+?)\nإيرادات: (.+?) \| مصروفات: (.+?) \| صافي: (.+?) ر\.س$/, '✅ Summary for $1 saved\nIncome: $2 | Expenses: $3 | Net: $4 SAR'],
    [/^حدث خطأ أثناء الحفظ: ([\s\S]*)$/, 'An error occurred while saving: $1'],
    // Undo toast descriptions
    [/^(تعديل|إضافة) حساب "(.*?)" #(\w+)$/, (m, op, name, id) => `${op === 'تعديل' ? 'Edit' : 'Add'} account "${name}" #${id}`],
    [/^حذف "(.*?)" #(\w+)$/, 'Delete "$1" #$2'],
    [/^حذف جماعي \((\d+) حساب\)$/, 'Bulk delete ($1 account(s))'],
    [/^تفعيل جميع حسابات (.+?) \((\d+)\)$/, 'Activate all $1 accounts ($2)'],
    [/^إيقاف فوري \((\d+) حساب\)$/, 'Immediate stop ($1 account(s))'],
    [/^نقل عهدة \((\d+) حساب\) إلى (.+?) - (.+?)$/, 'Transfer ($1 account(s)) to $2 — $3'],
    [/^تصفير مخصص \((.+?)\)$/, 'Custom reset ($1)'],
    [/^تعديل سيارة (.+?)$/, 'Edit vehicle $1'],
    [/^حذف سيارة (.+?)$/, 'Delete vehicle $1'],
    [/^تعديل موظف "(.*?)"$/, 'Edit employee "$1"'],
    [/^تعديل صنف مستودع "(.*?)"$/, 'Edit warehouse item "$1"']
];

// Inline bilingual helper for rich content (Swal html, dynamic strings)
function L(ar, en) { return currentLang === 'en' ? en : ar; }

function translateUserMessage(text) {
    if (currentLang !== 'en' || text == null) return text;
    let s = String(text);
    if (MSG_EXACT[s] !== undefined) return MSG_EXACT[s];
    for (let i = 0; i < MSG_PATTERNS.length; i++) {
        if (MSG_PATTERNS[i][0].test(s)) return s.replace(MSG_PATTERNS[i][0], MSG_PATTERNS[i][1]);
    }
    return s;
}

// Intercept native alert/confirm to auto-translate when in English mode
(function () {
    const _origAlert = window.alert.bind(window);
    const _origConfirm = window.confirm.bind(window);
    window.alert = function (m) { return _origAlert(translateUserMessage(m)); };
    window.confirm = function (m) { return _origConfirm(translateUserMessage(m)); };
})();
