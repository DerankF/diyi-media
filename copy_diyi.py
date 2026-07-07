"""
帝意传媒项目组 - 文件复制脚本 v2
从 D:\融媒体发布助手\帝意传媒-mini 复制到 D:\Projects\diyi-media
"""
import shutil
import os
import sys

SOURCE_BASE = r"D:\融媒体发布助手\帝意传媒-mini"
TARGET_BASE = r"D:\Projects\diyi-media"

# 定义复制任务
COPY_TASKS = [
    {
        "name": "绿色版",
        "source": os.path.join(SOURCE_BASE, "帝意传媒-绿色版"),
        "target": os.path.join(TARGET_BASE, "green-version")
    },
    {
        "name": "主程序",
        "source": os.path.join(SOURCE_BASE, "帝意传媒"),
        "target": os.path.join(TARGET_BASE, "main-app")
    },
    {
        "name": "Release2",
        "source": os.path.join(SOURCE_BASE, r"release2\win-unpacked"),
        "target": os.path.join(TARGET_BASE, "release2")
    }
]

def remove_if_empty(path):
    """如果目录存在且为空，删除它"""
    if os.path.exists(path):
        if os.path.isdir(path):
            try:
                os.rmdir(path)  # 只能删除空目录
                print(f"  [清理] 删除空目录: {path}")
                return True
            except OSError:
                # 目录不为空
                print(f"  [提示] 目录不为空，保留: {path}")
                return False
        else:
            print(f"  [警告] 存在同名文件: {path}")
            return False
    return True

def copy_directory(src, dst, desc):
    """复制目录"""
    if not os.path.exists(src):
        print(f"[跳过] {desc}: 源目录不存在")
        print(f"  路径: {src}")
        return False
    
    # 如果目标存在，先尝试清理空目录
    if os.path.exists(dst):
        print(f"[检查] {desc}: 目标已存在，检查内容...")
        files = os.listdir(dst)
        if len(files) == 0:
            print(f"  [清理] 目标为空，删除后重新复制")
            shutil.rmtree(dst)
        else:
            print(f"  [跳过] 目标已有内容 ({len(files)} 项)，跳过")
            return False
    
    print(f"[开始] 复制 {desc}...")
    print(f"  从: {src}")
    print(f"  到: {dst}")
    
    try:
        shutil.copytree(src, dst)
        count = sum([len(files) for r, d, files in os.walk(dst)])
        print(f"[成功] {desc} 复制完成 (约 {count} 个文件)")
        return True
    except Exception as e:
        print(f"[错误] {desc}: {e}")
        return False

def main():
    print("=" * 60)
    print("帝意传媒项目组 - 文件整理 v2")
    print("=" * 60)
    
    success = 0
    skipped = 0
    
    for task in COPY_TASKS:
        print()
        result = copy_directory(task["source"], task["target"], task["name"])
        if result:
            success += 1
        else:
            skipped += 1
    
    print()
    print("=" * 60)
    print(f"完成: 成功 {success} 项, 跳过 {skipped} 项")
    print("=" * 60)

if __name__ == "__main__":
    main()
