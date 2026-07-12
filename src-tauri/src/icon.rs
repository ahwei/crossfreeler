use base64::Engine;
use pelite::resources::FindError;
use pelite::PeFile;
use std::io::Cursor;

/// 從 Windows PE 檔（.exe/.dll）抽出最佳圖示，回傳 `data:image/png;base64,...`。
/// 任一步驟失敗都回 None，讓前端 fallback 到預設圖示。
pub fn extract_png_data_url(path: &str) -> Option<String> {
    let map = pelite::FileMap::open(path).ok()?;
    let file = PeFile::from_bytes(map.as_ref()).ok()?;
    let resources = file.resources().ok()?;

    // 取第一個 icon group，組成 .ico bytes
    let ico_bytes = match resources.icons().next() {
        Some(Ok((_, group))) => {
            let mut buf = Vec::new();
            group.write(&mut buf).ok()?;
            buf
        }
        Some(Err(FindError::NotFound)) | None => return None,
        Some(Err(_)) => return None,
    };

    // 解碼 ICO（image 會選內部影像），縮成合理大小後輸出 PNG
    let img = image::load_from_memory_with_format(&ico_bytes, image::ImageFormat::Ico).ok()?;
    let img = if img.width() > 128 || img.height() > 128 {
        img.resize(128, 128, image::imageops::FilterType::Lanczos3)
    } else {
        img
    };

    let mut png = Cursor::new(Vec::new());
    img.write_to(&mut png, image::ImageFormat::Png).ok()?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(png.into_inner());
    Some(format!("data:image/png;base64,{b64}"))
}
