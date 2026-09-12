// splitSqlStatements 切分器测试：引号内分号不切、'' 转义、-- 注释剔除、USE 过滤、顺序保持。
// 这些是 runMigrations 正确执行迁移文件的前提（抽自 index.js，行为回归见各用例）。
import { describe, it, expect } from 'vitest'
const splitSqlStatements = require('./splitSqlStatements')

describe('splitSqlStatements · 分句', () => {
  it('引号外分号正常切分，多条语句顺序保持', () => {
    const sql = 'CREATE TABLE a (id INT);\nALTER TABLE a ADD COLUMN c INT;\n'
    expect(splitSqlStatements(sql)).toEqual([
      'CREATE TABLE a (id INT)',
      'ALTER TABLE a ADD COLUMN c INT',
    ])
  })

  it('引号内的分号不切（CHECK 约束字面量）', () => {
    const sql = "CREATE TABLE t (v VARCHAR(10), CHECK (v IN ('a;b')));"
    expect(splitSqlStatements(sql)).toEqual([
      "CREATE TABLE t (v VARCHAR(10), CHECK (v IN ('a;b')))",
    ])
  })

  it('引号内的分号不切（INSERT 字面量）', () => {
    const sql = "INSERT INTO t (name) VALUES ('x;y');"
    expect(splitSqlStatements(sql)).toEqual(["INSERT INTO t (name) VALUES ('x;y')"])
  })

  it("'' 连续单引号按转义处理，不提前结束字符串", () => {
    // 'it''s;a' 里的分号在字符串内；字符串在第二个 ' 后正确结束
    const sql = "INSERT INTO t (name) VALUES ('it''s;a');"
    expect(splitSqlStatements(sql)).toEqual(["INSERT INTO t (name) VALUES ('it''s;a')"])
  })

  it('未闭合字符串后的分号被保护到字符串闭合为止（不抛错、不误切）', () => {
    // 引号在行内成对闭合：前半 'a;b' 是字符串，随后 ; 在引号外，可切
    const sql = "INSERT INTO t VALUES ('a;b');SELECT 1;"
    expect(splitSqlStatements(sql)).toEqual(["INSERT INTO t VALUES ('a;b')", 'SELECT 1'])
  })

  it('末尾无分号的语句也保留', () => {
    expect(splitSqlStatements('SELECT 1')).toEqual(['SELECT 1'])
  })
})

describe('splitSqlStatements · 清洗', () => {
  it('-- 注释行剔除（注释行本身不残留进语句）', () => {
    const sql = [
      '-- 激活码注册系统',
      'ALTER TABLE a ADD COLUMN c INT;',
      '  -- 缩进注释',
      'ALTER TABLE a ADD d INT;',
    ].join('\n')
    expect(splitSqlStatements(sql)).toEqual([
      'ALTER TABLE a ADD COLUMN c INT',
      'ALTER TABLE a ADD d INT',
    ])
  })

  it('字符串内的 -- 不被误删', () => {
    const sql = "INSERT INTO t (name) VALUES ('a--b');"
    expect(splitSqlStatements(sql)).toEqual(["INSERT INTO t (name) VALUES ('a--b')"])
  })

  it('USE 语句过滤', () => {
    const sql = 'USE mydb;\nCREATE TABLE a (id INT);'
    expect(splitSqlStatements(sql)).toEqual(['CREATE TABLE a (id INT)'])
  })

  it('空语句/纯注释段丢弃', () => {
    const sql = ';;\n-- only a comment\n;\nSELECT 1;\n'
    expect(splitSqlStatements(sql)).toEqual(['SELECT 1'])
  })

  it('句尾分号剥离且空白规整', () => {
    expect(splitSqlStatements('  SELECT   1  ;  ')).toEqual(['SELECT   1'])
  })
})
