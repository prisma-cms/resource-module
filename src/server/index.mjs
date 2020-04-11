
import startServer from "@prisma-cms/server";
import URI from 'urijs';

import Module from "../";


const module = new Module({
});

const resolvers = module.getResolvers();



/**
 * Получаем проект из запроса.
 * Это нужно для определения того, к какому конкретному проекту относится запрос
 */
const getProjectFromRequest = async function (ctx) {

  // console.log("ctx", ctx.request.headers);

  const {
    request: {
      headers: {
        origin,
      },
    },
    db,
  } = ctx;

  if (!origin) {
    return;
  }

  const uri = new URI(origin);

  const domain = uri.domain();

  if (!domain) {
    return;
  }

  // console.log("ctx domain", domain);

  return await db.query.project({
    where: {
      domain,
    },
  });
}


startServer({
  typeDefs: 'src/schema/generated/api.graphql',
  resolvers,
  contextOptions: {
    getProjectFromRequest,
  },
});
