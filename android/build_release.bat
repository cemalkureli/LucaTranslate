@echo off
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\Luca\AppData\Local\Android\Sdk
set PATH=%JAVA_HOME%\bin;%ANDROID_HOME%\platform-tools;%PATH%
echo Building release APK (cache on C:)...
"D:\Users\Luca\Desktop\translator_app\android\gradlew.bat" -p "D:\Users\Luca\Desktop\translator_app\android" --project-cache-dir "C:\gradle-cache\translator" assembleRelease --no-daemon
echo Build exit code: %ERRORLEVEL%
