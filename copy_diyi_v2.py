"""
帝意传媒项目组 - 文件复制脚本 v2
"""
import shutil
import os

SOURCE_BASE = r"D:\融媒体发布助手\帝意传媒-mini"
TARGET_BASE = r"D:\Projects\diyi-media"

def copy_task(name, src_rel, dst_rel):
    src = os.path.join(SOURCE_BASE, src_rel)
    dst = os.path.join(TARGET_BASE, dst_rel)
    
    print("\n[任务] %s" % name)
    print("  源: %s" % src)
    print("  目标: %s" % dst)
    
    if not os.path.exists(src):
        print("  [跳过] 源不存在")
        return
    
    # 如果目标存在且有内容，跳过
    if os.path.exists(dst):
        items = os.listdir(dst)
        if len(items) > 0:
            print("  [跳过] 目标已有 %d 项内容" % len(items))
            return
        else:
            # 空目录，删除
            os.rmdir(dst)
    
    # 复制
    try:
        shutil.copytree(src, dst)
        print("  [成功] 复制完成")
    except Exception as e:
        print("  [错误] %s" % str(e))

def main():
    print("=" * 60)
    print("帝意传媒项目组 - 文件整理")
    print("=" * 60)
    
    copy_task("绿色版", "帝意传媒-绿色版", "green-version")
    copy_task("主程序", "帝意传媒", "main-app")
    copy_task("Release2", r"release2\win-unpacked", "release2")
    
    print("\n" + "=" * 60)
    print("完成")
    print("=" * 60)

if __name__ == "__main__":
    main()
