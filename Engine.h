#pragma once

///Users/jhelms/projects/emsdk/emscripten/1.38.27/emcc main.cpp -std=c++11 -O2 -I../../ -s WASM=0 -s --js-library ../../library_engine.js -s ASSERTIONS=2 -o main.js

#include <vector>
#include <functional>

#include <emscripten.h>
#include <emscripten/html5.h>

#include <SDL/SDL.h>

extern "C"
{
	extern void Engine_Test1();
	extern void Engine_FillPage();
	extern void Engine_Init();
	extern void Engine_FilledEllipse(float x, float y, float width, float height, uint32_t rgba);
	extern void Engine_FilledRectangle(float x, float y, float width, float height, uint32_t rgba);
	extern void Engine_FilledText(const char* text, float x, float y, float fontSize, uint32_t rgba);
	extern void Engine_Image(const char* name, float x, float y, float width, float height, uint32_t rgba);
	extern void Engine_RoundedRectangle(
		float x, float y,
		float width, float height,
		float radius, float thickness,
		uint32_t strokeRgba, uint32_t fillRgba);
}

enum Type
{
	None,
	Circle,
	Rectangle,
	RoundedRectangle,
	Text,
	Image,
};

struct Vector2
{
	float x;
	float y;
	Vector2()
	: x(0.0)
	, y(0.0) {}
	Vector2(float x, float y)
	: x(x)
	, y(y) {}
};

struct Entity
{
	Vector2 coord1;
	Vector2 coord2;
	Vector2 coord3;
	Vector2 coord4;
	uint32_t id1;
	uint32_t id2;
	Type type;

	Entity()
	: id1(0)
	, id2(0)
	, type(Type::None) {}

	static Entity circle(
		const Vector2& position,
		float radius,
		uint32_t rgba)
	{
		Entity entity;
		entity.type = Type::Circle;
		entity.coord1 = position;
		entity.coord3 = Vector2(radius, radius);
		entity.id1 = rgba;
		return entity;
	}

	static Entity rectangle(
		const Vector2& position,
		const Vector2& size,
		uint32_t rgba)
	{
		Entity entity;
		entity.coord1 = position;
		entity.coord3 = size;
		entity.id1 = rgba;
		return entity;
	}
};

struct Game
{
	std::vector<Entity> entities;

	void draw(double currentTime, uint64_t count)
	{
		for (int64_t i = 0; i < entities.size(); ++i)
		{
			const Entity& entity = entities[i];
			switch (entity.type)
			{
				case Type::Circle:
				{
					break;
				}
				case Type::Rectangle:
				{
					break;
				}
				default:
				{
					break;
				}
			}
		}
	}
};




