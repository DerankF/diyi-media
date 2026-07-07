"""复制安装程序"""
import shutil
import os

src = r"D:\融媒体发布助手\帝意传媒-mini\D&E Media Setup 1.0.0.exe"
dst = r"D:\Projects\diyi-media"

print("复制安装程序...")
print("源: %s" % src)
print("目标: %s" % dst)

if not os.path.exists(src):
    print("[错误] 源文件不存在")
else:
    try:
        shutil.copy(src, dst)
        print("[成功] 安装程序已复制")
    except Exception as e:
        print("[错误] %s" % str(e))
