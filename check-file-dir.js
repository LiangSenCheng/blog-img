const fs = require('fs');
const path = require('path');
const axios = require("axios");
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 检测是否为忽略path/file
 * @param {*} path 
 * @returns 
 */
function ignorePathCheck(path) {
  const ignorePath = [".git", ".github", ".history", "node_modules", ".js", ".lock", ".md", ".gitignore"];
  const res = ignorePath.some(item => {
    return path.includes(item);
  });
  return res;
};

/**
 * 遍历当前目录路径下的文件和目录
 * @param {*} filePath 需要遍历的目录路径
 * @returns 当前目录路径下的文件列表和目录列表
 */
function fileDisplay(filePath) {
  // 文件路径列表
  const filePathList = [];
  // 目录列表
  const folderPathList = [];
  //根据文件路径读取文件，返回文件列表
  const files = fs.readdirSync(filePath);
  //遍历读取到的文件列表
  files.forEach((filename) => {
    //获取当前文件的绝对路径
    const filedir = path.join(filePath, filename);
    const pathStr = filedir.replace(process.cwd(), "");
    const relativePath = pathStr.replace(/\\/g, "/");
    //根据文件路径获取文件信息，返回一个fs.Stats对象
    const stats = fs.statSync(filedir);
    // 该路径是文件
    if (stats.isFile() && !ignorePathCheck(relativePath)) {
      filePathList.push(relativePath);
    }
    // 该路径是文件夹
    if (stats.isDirectory() && !ignorePathCheck(relativePath)) {
      folderPathList.push(relativePath);
    }
  });
  return {
    filePathList,
    folderPathList,
  };
}

/**
 * 遍历folderPath路径下的所有文件路径
 * @param {*} folderPath 第一层目录路径,后续生成的相对路径只需将其替换成空字符串
 * @returns 返回folderPath路径下的所有文件路径
 */
function main(folderPath) {
  // 文件路径列表
  let filePathList = [];
  // 目录列表
  let folderPathList = [];
  // 初始化当前正在遍历的目录名
  let curFolderPath = "./";

  do {
    if (folderPathList.length > 0) {
      // 更新新的当前正在遍历的目录路径
      curFolderPath = folderPathList.shift();
    }
    //解析需要遍历的文件夹路径
    let filePath = path.resolve(path.join(folderPath, curFolderPath));
    // 遍历结果
    let pathList = fileDisplay(filePath, folderPath);

    filePathList = filePathList.concat(pathList.filePathList);
    folderPathList = folderPathList.concat(pathList.folderPathList);

  } while (folderPathList.length > 0);
  return filePathList;
}

// 所有文件路径
let list = main(process.cwd());
console.log("filesList-res", list, process.cwd());

// 执行结果
let result = {
  total: list.length,
  ok: 0, // 成功
  fail: 0, // 失败
  failList: [], // 错误列表
  time: "",
};

async function frushcdn() {
  if (list.length === 0) {
    result.failList = Array.from(new Set(result.failList));
    result.fail = result.failList.length;
    console.log(result);
    return;
  }
  const filePath = list.shift();
  let state = "";
  try {
    // 上面的请求也可以这样做
    const res = await axios.get(`https://purge.jsdelivr.net/gh/LiangSenCheng/blog-img${filePath}`, {});
    result.time = dayjs(res.data.timestamp).tz("Asia/Shanghai").format("YYYY-MM-DD HH:MM:ss")
    if (res.status === 200) {
      if (res.data.status === "finished") {
        result.ok += 1;
        state = "ok";
      } else {
        result.fail += 1;
        state = "err";
        result.failList.push(filePath);
      }
    } else {
      result.fail += 1;
      state = "err";
      result.failList.push(filePath);
    }
  } catch (err) {
    result.fail += 1;
    state = "err";
    result.failList.push(filePath);
    console.log(err);
  } finally {
    console.log("CDN:", filePath, "state:", state);
  }
  // 递归调用刷新CDN方法
  frushcdn();
}

// 开始执行脚本
frushcdn();
