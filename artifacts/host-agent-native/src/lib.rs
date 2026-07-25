extern crate napi_derive;

use napi::bindgen_prelude::*;
use napi_derive::napi;

/// POC: returns whether native capture would be available on this machine.
/// Full DXGI Desktop Duplication + NVENC integration lands in a follow-up PR.
#[napi]
pub fn probe_native_capture() -> Result<bool> {
    Ok(cfg!(target_os = "windows"))
}

/// POC: placeholder frame dimensions for the native capture pipeline.
#[napi(object)]
pub struct CaptureInfo {
    pub width: u32,
    pub height: u32,
    pub available: bool,
}

#[napi]
pub fn get_capture_info() -> Result<CaptureInfo> {
    Ok(CaptureInfo {
        width: 1920,
        height: 1080,
        available: cfg!(target_os = "windows"),
    })
}
