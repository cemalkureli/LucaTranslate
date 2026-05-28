@echo off
set ANDROID_HOME=C:\Users\Luca\AppData\Local\Android\Sdk
set PATH=%ANDROID_HOME%\platform-tools;%PATH%
adb devices
