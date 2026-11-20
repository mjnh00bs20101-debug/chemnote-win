# Hướng dẫn xuất file `.exe` cho Windows (ChemNote Electron)

## Cách 1: Tự động xuất `.exe` miễn phí bằng GitHub Actions (Không cần máy Windows)
1. Push thư mục dự án (bao gồm `.github/workflows/build-windows.yml` và `Chemnote_Windows_Electron/`) lên GitHub.
2. Trên GitHub, mở tab **Actions** -> chọn workflow **Build Windows EXE (ChemNote)** -> bấm **Run workflow**.
3. Sau ~2–3 phút, tải về 2 file trong mục **Artifacts**:
   - `ChemNote-Setup-<version>-win-x64.exe` (bộ cài đặt Windows NSIS tạo shortcut Desktop/Start Menu)
   - `ChemNote-Portable-<version>-win-x64.exe` (bản chạy thẳng không cần cài)

## Cách 2: Build trực tiếp trên máy Windows
Yêu cầu cài sẵn **Node.js (v18/v20 LTS)**.
Mở Command Prompt / PowerShell trong thư mục `Chemnote_Windows_Electron` và chạy:

```bat
npm install
npm run dist:win
```

File `.exe` sau khi build sẽ nằm trong thư mục `Chemnote_Windows_Electron\dist\`.

## Đồng bộ lại code mới từ Mac
Mỗi khi bạn sửa code web ChemNote trên Mac, chỉ cần chạy lại lệnh sau ở thư mục gốc `/Users/ddd/Desktop/chemnote`:

```bash
python3 build_windows_electron.py
```
Lệnh này tự động cập nhật `Chemnote_Windows_Electron/app/`, đồng bộ `version`, tạo lại `build/icon.ico` và đóng gói `Chemnote_Windows_Electron.zip`.
