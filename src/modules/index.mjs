
import fs from "fs";

import chalk from "chalk";

import PrismaModule from "@prisma-cms/prisma-module";
import LogModule from "@prisma-cms/log-module";
// import UploadModule from "@prisma-cms/upload-module";
import PrismaProcessor from "@prisma-cms/prisma-processor";

import MergeSchema from 'merge-graphql-schemas';

import path from 'path';

const moduleURL = new URL(import.meta.url);

const __dirname = path.dirname(moduleURL.pathname);

const { createWriteStream, unlinkSync } = fs;

const { fileLoader, mergeTypes } = MergeSchema


import Translit from "translit";
import TranslitRussian from "translit-russian";
import URI from "urijs";


export class ResourceProcessor extends PrismaProcessor {

  constructor(props) {

    super(props);

    this.objectType = "Resource";

    this.private = true;
    this.ownable = true;

  }


  async create(method, args, info) {

    const {
      ctx,
    } = this;

    const {
      getProjectFromRequest,
    } = ctx;

    let {
      data: {
        name,
        uri,
        PrismaProject,
        ...data
      },
    } = args;


    let uriData = await this.prepareUri(args);


    /**
     * Пытаемся получить проект по заголовкам запроса.
     * Если получим, то устанавливаем в качестве проекта.
     * Если нет, то сбрасываем.
     */
    const project = await getProjectFromRequest(ctx);

    if (project) {

      const {
        id: projectId,
      } = project;

      PrismaProject = {
        connect: {
          id: projectId,
        },
      }

    }
    else {
      PrismaProject = undefined;
    }


    // console.log("PrismaProject", PrismaProject);


    Object.assign(data, {
      PrismaProject,
      ...uriData,
      // ...this.getCreatedBy(),
    });


    Object.assign(args, {
      data,
    });

    // return this.addFieldError("test", "error");

    if (!data.uri) {
      return this.addError("Не был сформирован uri документа");
    }

    return super.create(method, args, info);
  }


  async update(method, args, info) {

    let {
      data: {

        // Запрещаем обновление проекта
        PrismaProject,
        ...data
      },
    } = args;


    Object.assign(data, {
    });


    Object.assign(args, {
      data,
    });


    return super.update(method, args, info);
  }


  async mutate(method, args, info) {

    if (args.data) {

      let {
        name,
        content,
        contentText,
        ...data
      } = args.data || {};

      this.prepareContent(args, data, method);

      name = this.prepareName(args);

      Object.assign(data, {
        name,
      });


      Object.assign(args, {
        data,
      });

      // console.log('ResourceProcessor data', JSON.stringify(data, true, 2));
    }

    return super.mutate(method, args);
  }


  prepareContent(args, data, method) {

    let {
      data: {
        content,
      },
    } = args;

    if (content !== undefined) {

      const {
        blocks,
      } = content || {};

      let textArray = blocks && blocks.map(({ text }) => text && text.trim() || "").filter(n => n) || [];

      let contentText = textArray.join(" ");

      Object.assign(data, {
        content,
        contentText,
      });
    }

    // console.log(chalk.green("prepareContent content"), typeof content, content, data);

    // this.addError("Sdfsdfsdf");

    return data;
  }


  // getCreatedBy() {

  //   const {
  //     currentUser,
  //   } = this.ctx;

  //   if (!currentUser) {
  //     this.addError("Необходимо авторизоваться");
  //     return;
  //   }

  //   const {
  //     id,
  //   } = currentUser;

  //   return {
  //     CreatedBy: {
  //       connect: {
  //         id,
  //       },
  //     },
  //   }
  // }


  prepareName(args) {

    let {
      data: {
        name,
      },
    } = args;

    if (name !== undefined) {
      name = name && name.trim() || null;

      if (!name) {
        this.addFieldError("name", "Не заполнено название");
      }
    }

    return name;
  }


  async prepareUri(args, cycles = 10) {

    const {
      db,
    } = this.ctx;

    let {
      data: {
        name,
        uri,
        isfolder = true,
        Parent,
      },
    } = args;

    // console.log(chalk.green("prepareUri uri"), uri);

    name = this.prepareName(args);

    /**
     * Если нет УРИ, генерируем из родителя и алиаса.
     * При этом надо проверять на уникальность
     */
    if (!uri) {

      uri = new URI(this.escapeUri(name));

      if (Parent && Parent.connect) {

        let parent = await db.query.resource({
          where: Parent.connect,
        });

        if (parent) {

          let parentUri = new URI(parent.uri);

          // let parentDirname;

          // let parentFilename = parentUri.filename();

          // if(parentFilename){
          //   parentDirname
          // }

          // this.addFieldError("test parentFilename", parentFilename);

          parentUri.suffix("");

          // this.addFieldError("test parentUri", parentUri.path());

          uri.directory(parentUri.path());

          // this.addFieldError("test uri", uri.toString());
        }
        else {
          throw new Error("Can not get parent resource");
        }

      }

      uri = uri.toString();
    }

    if (uri !== undefined) {

      uri = this.translit(uri.trim()).replace(/[\?\# ]+/g, '-').toLowerCase();

      uri = new URI(uri);

      // console.log(chalk.green("URL"), uri);

      let segment = uri.segment();

      // console.log(chalk.green("segment"), segment);

      segment = segment.map(n => this.escapeUri(n).replace(/^\-+|\-$/g, '').trim()).filter(n => n);

      // console.log(chalk.green("segment 2"), segment);

      uri.segment(segment);


      let pathname = uri.pathname();

      if (!pathname.startsWith("/")) {
        pathname = `/${pathname}`;
      }


      if (!isfolder) {
        let suffix = uri.suffix()

        if (!suffix) {
          this.addSuffix(uri);
        }
      }
      else {

        if (!pathname.endsWith("/")) {
          pathname = `${pathname}/`;
        }

      }

      uri.pathname(pathname);

      // Проверяем на уникальность
      const exists = await db.exists.Resource({
        uri: uri.toString(),
      });

      if (exists) {

        if (cycles === 0) {

          this.addFieldError("uri", "Ошибка генерации уникального УРЛ. Превышено количество попыток.");
          return;
        }

        // console.log(chalk.green("exists uri"), uri);

        // this.addFieldError("uri", "test");

        // return this.prepareUri(args);
        let filename = uri.filename();

        if (!filename) {
          this.addFieldError("uri", "Ошибка генерации уникального УРЛ");
        }
        else {

          let suffix = uri.suffix();

          if (suffix) {

            uri.suffix("");

            filename = uri.filename();

            // console.log(chalk.green("Resulted filename 2"), filename);

          }
          // console.log(chalk.green("Resulted match"), match);

          let reg = /(\-(\d+)|)$/;

          let match = filename.match(reg);

          let index = match && parseInt(match[2]) || 0;

          filename = filename.replace(reg, `-${index + 1}`);

          uri.filename(filename);

          Object.assign(args.data, {
            uri: uri.toString(),
          });

          return this.prepareUri(args, cycles > 0 ? cycles-- : cycles);

        }

      }

      uri = URI.decode(uri.toString());
    }

    // console.log(chalk.green("Resulted uri"), uri);

    return {
      name,
      uri,
      isfolder,
    };
  }


  addSuffix(uri) {
    uri.suffix("html");
  }


  translit(word) {
    const translit = Translit(TranslitRussian);
    return translit(word);
  }

  escapeUri(uri) {
    return uri ? uri.replace(/[\/\?\% ]+/g, '-').replace(/\-+/g, '-') : "";
  }

}



class Module extends PrismaModule {


  constructor(props = {}) {

    super(props);

    this.mergeModules([
      LogModule,
      // UploadModule,
    ]);

  }


  getSchema(types = []) {


    let schema = fileLoader(__dirname + '/schema/database/', {
      recursive: true,
    });


    if (schema) {
      types = types.concat(schema);
    }


    let typesArray = super.getSchema(types);

    return typesArray;

  }


  getApiSchema(types = []) {


    let baseSchema = [];

    let schemaFile = __dirname + "/../schema/generated/prisma.graphql";

    if (fs.existsSync(schemaFile)) {
      baseSchema = fs.readFileSync(schemaFile, "utf-8");
    }

    let apiSchema = super.getApiSchema(types.concat(baseSchema), [
      // "ResourceCreateInput",
      // "ResourceUpdateInput",
      // "UserCreateOneWithoutResourcesInput",
      // "ResourceCreateOneWithoutChildsInput",
      // "ResourceCreateManyWithoutParentInput",
      // "UserUpdateOneWithoutResourcesInput",
      // "ResourceUpdateOneWithoutChildsInput",
      // "ResourceUpdateManyWithoutParentInput",
      // "ResourceUpdateManyWithoutCreatedByInput",
      // "ResourceCreateManyWithoutCreatedByInput",
      // "FileCreateOneWithoutImageResourceInput",
      // "FileUpdateOneWithoutImageResourceInput",
    ]);

    let schema = fileLoader(__dirname + '/schema/api/', {
      recursive: true,
    });

    apiSchema = mergeTypes([apiSchema.concat(schema)], { all: true });


    return apiSchema;

  }


  getResolvers() {

    const resolvers = super.getResolvers();


    Object.assign(resolvers.Query, {
      resource: this.resource,
      resources: this.resources,
      resourcesConnection: this.resourcesConnection,
    });


    Object.assign(resolvers.Mutation, {
      createResourceProcessor: this.createResourceProcessor.bind(this),
      updateResourceProcessor: this.updateResourceProcessor.bind(this),
      deleteResource: (source, args, ctx, info) => {
        return this.getProcessor(ctx).delete("Resource", args, info);
      },
    });

    // Object.assign(resolvers.Subscription, this.Subscription);


    Object.assign(resolvers, {
      ResourceResponse: this.ResourceResponse(),
    });

    return resolvers;
  }


  resources(source, args, ctx, info) {

    return ctx.db.query.resources(args, info);
  }

  resource(source, args, ctx, info) {
    return ctx.db.query.resource(args, info);
  }

  resourcesConnection(source, args, ctx, info) {
    return ctx.db.query.resourcesConnection(args, info);
  }


  getProcessor(ctx) {
    return new (this.getProcessorClass())(ctx);
  }

  getProcessorClass() {
    return ResourceProcessor;
  }

  createResourceProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).createWithResponse("Resource", args, info);
  }

  updateResourceProcessor(source, args, ctx, info) {

    return this.getProcessor(ctx).updateWithResponse("Resource", args, info);
  }

  ResourceResponse() {

    return {
      data: (source, args, ctx, info) => {

        const {
          id,
        } = source.data || {};

        return id ? ctx.db.query.resource({
          where: {
            id,
          },
        }, info) : null;
      }
    }
  }

}


export default Module;