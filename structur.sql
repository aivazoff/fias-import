DROP TABLE IF EXISTS addr_obj;
CREATE TABLE addr_obj (
 "id" bigint NOT NULL PRIMARY KEY,
 "objectid" bigint NOT NULL,
 "objectguid" uuid NOT NULL,
 "changeid" bigint NOT NULL,
 "name" varchar(250) NOT NULL,
 "typename" varchar(50) NOT NULL,
 "level" integer NOT NULL,
 "opertypeid" integer NOT NULL,
 "previd" bigint,
 "nextid" bigint,
 "updatedate" date NOT NULL,
 "startdate" date NOT NULL,
 "enddate" date NOT NULL,
 "isactual" boolean NOT NULL,
 "isactive" boolean NOT NULL,
 "region" integer NOT NULL
);

CREATE INDEX ON addr_obj(objectid);
CREATE INDEX ON addr_obj(objectguid);
CREATE INDEX ON addr_obj(region);
 
DROP TABLE IF EXISTS addr_obj_types;
CREATE TABLE addr_obj_types (
 "id" integer NOT NULL PRIMARY KEY,
 "level" integer NOT NULL,
 "shortname" varchar(50) NOT NULL,
 "name" varchar(250) NOT NULL,
 "desc" varchar(250),
 "updatedate" date NOT NULL,
 "startdate" date NOT NULL,
 "enddate" date NOT NULL,
 "isactive" boolean NOT NULL
);
 
DROP TABLE IF EXISTS mun_hierarchy;
CREATE TABLE mun_hierarchy (
 "id" bigint NOT NULL PRIMARY KEY,
 "objectid" bigint NOT NULL,
 "parentobjid" bigint,
 "changeid" bigint NOT NULL,
 "oktmo" varchar(11),
 "previd" bigint,
 "nextid" bigint,
 "updatedate" date NOT NULL,
 "startdate" date NOT NULL,
 "enddate" date NOT NULL,
 "isactive" boolean NOT NULL,
 "path" varchar NOT NULL,
 "region" integer NOT NULL
);

CREATE INDEX ON mun_hierarchy(objectid);
CREATE INDEX ON mun_hierarchy(parentobjid);
CREATE INDEX ON mun_hierarchy(region);
 
DROP TABLE IF EXISTS adm_hierarchy;
CREATE TABLE adm_hierarchy (
 "id" bigint NOT NULL PRIMARY KEY,
 "objectid" bigint NOT NULL,
 "parentobjid" bigint,
 "changeid" bigint NOT NULL,
 "regioncode" varchar(4),
 "areacode" varchar(4),
 "citycode" varchar(4),
 "placecode" varchar(4),
 "plancode" varchar(4),
 "streetcode" varchar(4),
 "previd" bigint,
 "nextid" bigint,
 "updatedate" date NOT NULL,
 "startdate" date NOT NULL,
 "enddate" date NOT NULL,
 "isactive" boolean NOT NULL,
 "path" varchar NOT NULL,
 "region" integer NOT NULL
);

CREATE INDEX ON adm_hierarchy(objectid);
CREATE INDEX ON adm_hierarchy(parentobjid);
CREATE INDEX ON adm_hierarchy(region);
 
DROP TABLE IF EXISTS object_levels;
CREATE TABLE object_levels (
 "level" integer NOT NULL PRIMARY KEY,
 "name" varchar(250) NOT NULL,
 "shortname" varchar(50),
 "updatedate" date NOT NULL,
 "startdate" date NOT NULL,
 "enddate" date NOT NULL,
 "isactive" boolean NOT NULL
);
 
DROP TABLE IF EXISTS house_types;
CREATE TABLE house_types (
 "id" integer NOT NULL PRIMARY KEY,
 "name" varchar(50) NOT NULL,
 "shortname" varchar(50),
 "desc" varchar(250),
 "updatedate" date NOT NULL,
 "startdate" date NOT NULL,
 "enddate" date NOT NULL,
 "isactive" boolean NOT NULL
);

DROP TABLE IF EXISTS houses;
CREATE TABLE houses (
 "id" bigint NOT NULL PRIMARY KEY,
 "objectid" bigint NOT NULL,
 "objectguid" uuid NOT NULL,
 "changeid" bigint NOT NULL,
 "housenum" varchar(50),
 "addnum1" varchar(50),
 "addnum2" varchar(50),
 "housetype" integer,
 "addtype1" integer,
 "addtype2" integer,
 "opertypeid" integer NOT NULL,
 "previd" bigint,
 "nextid" bigint,
 "updatedate" date NOT NULL,
 "startdate" date NOT NULL,
 "enddate" date NOT NULL,
 "isactual" boolean NOT NULL,
 "isactive" boolean NOT NULL,
 "region" integer NOT NULL
);

CREATE INDEX ON houses(objectid);
CREATE INDEX ON houses(objectguid);
CREATE INDEX ON houses(region);