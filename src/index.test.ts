// There should be a 1:1 mapping between <filename>.ts and <filename>.test.ts
// Test files should test the code that <filename>.ts exports only.
// It should not need to import or require anything besides ./<filename>.js and test utilities
// Good governance for unit and component testing that also compromises on speed ensures that when commiting
// Only tests related to the code you're changing are run
// Thefore when foo.ts is changed, foo.test.ts is run, and not baz.test.ts or bar/index.test.ts
