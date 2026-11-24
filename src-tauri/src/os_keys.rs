use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};

static GRAB: AtomicBool = AtomicBool::new(false);
static APP: OnceLock<AppHandle> = OnceLock::new();

#[cfg(windows)]
static HOOK: Mutex<Option<isize>> = Mutex::new(None);

#[derive(Clone, Serialize)]
struct OsKey {
    code: String,
    key: String,
    down: bool,
}

pub fn set_app(app: AppHandle) {
    let _ = APP.set(app);
    #[cfg(windows)]
    install_hook();
}

pub fn grab() {
    GRAB.store(true, Ordering::Relaxed);
}

pub fn ungrab() {
    GRAB.store(false, Ordering::Relaxed);
}

#[cfg(windows)]
fn install_hook() {
    use windows::Win32::Foundation::HINSTANCE;
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::UI::WindowsAndMessaging::{SetWindowsHookExW, WH_KEYBOARD_LL};

    let mut slot = HOOK.lock().unwrap_or_else(|e| e.into_inner());
    if slot.is_some() {
        return;
    }
    unsafe {
        let hmod = GetModuleHandleW(None).unwrap_or_default();
        match SetWindowsHookExW(
            WH_KEYBOARD_LL,
            Some(low_level_keyboard),
            HINSTANCE(hmod.0),
            0,
        ) {
            Ok(hook) => *slot = Some(hook.0 as isize),
            Err(_) => *slot = None,
        }
    }
}

#[cfg(windows)]
unsafe extern "system" fn low_level_keyboard(
    code: i32,
    wparam: windows::Win32::Foundation::WPARAM,
    lparam: windows::Win32::Foundation::LPARAM,
) -> windows::Win32::Foundation::LRESULT {
    use windows::Win32::Foundation::LRESULT;
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, KBDLLHOOKSTRUCT, WM_KEYDOWN, WM_KEYUP, WM_SYSKEYDOWN, WM_SYSKEYUP,
    };

    if code >= 0 && GRAB.load(Ordering::Relaxed) {
        let kb = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
        let vk = kb.vkCode;
        if vk == 0x5B || vk == 0x5C {
            let wp = wparam.0 as u32;
            let down = wp == WM_KEYDOWN || wp == WM_SYSKEYDOWN;
            let up = wp == WM_KEYUP || wp == WM_SYSKEYUP;
            if down || up {
                if let Some(app) = APP.get() {
                    let right = vk == 0x5C;
                    let _ = app.emit(
                        "os-key",
                        OsKey {
                            code: if right {
                                "MetaRight".into()
                            } else {
                                "MetaLeft".into()
                            },
                            key: "Meta".into(),
                            down,
                        },
                    );
                }
            }
            return LRESULT(1);
        }
    }
    CallNextHookEx(None, code, wparam, lparam)
}
