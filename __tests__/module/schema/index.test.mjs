
import expect from 'expect'

import chalk from "chalk";

import {
  verifySchema,
} from "../../default/schema.test.mjs";

import TestModule from "../../../";


import mocha from 'mocha'
const { describe, it } = mocha

const module = new TestModule();


/**
 */

const requiredTypes = [
  {
    name: "Query",
    fields: {
      both: [
      ],
      prisma: [
      ],
      api: [
        "resource",
        "resources",
        "resourcesConnection",
      ],
    },
  },
  {
    name: "User",
    fields: {
      both: [
        "id",
        "Resources",
      ],
      prisma: [
      ],
      api: [
      ],
    },
  },
  {
    name: "Resource",
    fields: {
      both: [
        "id",
        "createdAt",
        "updatedAt",
        "name",
        "longtitle",
        "content",
        "alias",
        "published",
        "deleted",
        "hidemenu",
        "searchable",
        "uri",
        "uri_override",
        "CreatedBy",
      ],
      prisma: [
      ],
      api: [
      ],
    },
  },
]




describe('modxclub Verify prisma Schema', () => {

  verifySchema(module.getSchema(), requiredTypes);

});


describe('modxclub Verify API Schema 2', () => {

  verifySchema(module.getApiSchema(), requiredTypes);

});