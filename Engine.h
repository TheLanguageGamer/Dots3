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
	extern int32_t Engine_GetMode();
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

EM_JS(float, getCanvasWidth, (), {
	var d = document,
	    g = d.getElementsByTagName('canvas')[0],
	    x = g.clientWidth;
	return x;
});

EM_JS(float, getCanvasHeight, (), {
	var d = document,
	    g = d.getElementsByTagName('canvas')[0],
	    y = g.clientHeight;
	return y;
});

struct Game
{
	Game()
	: count(0)
	, lastTime(emscripten_get_now())
	{
		Engine_Init();
	}

	uint32_t count;
	double lastTime;
	Vector2 screenSize;
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
					Engine_FilledEllipse(
						entity.coord1.x + entity.coord3.x,
						entity.coord1.y + entity.coord3.y,
						entity.coord3.x,
						entity.coord3.y,
						entity.id1);
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

	void pollEvents()
	{
		SDL_Event e;
		while(SDL_PollEvent(&e))
		{
			switch (e.type)
			{
				case SDL_QUIT:
				{
					std::terminate();
					break;
				}
				case SDL_KEYUP:
				{
					//
					break;
				}
				case SDL_KEYDOWN:
				{
					//
					break;
				}
				case SDL_MOUSEBUTTONDOWN:
				{
					SDL_MouseButtonEvent *m = (SDL_MouseButtonEvent*)&e;
					//printf("button down: %d,%d  %d,%d\n", m->button, m->state, m->x, m->y);
					//
					break;
				}
				case SDL_MOUSEBUTTONUP:
				{
					SDL_MouseButtonEvent *m = (SDL_MouseButtonEvent*)&e;
					//printf("button up: %d,%d  %d,%d\n", m->button, m->state, m->x, m->y);
					//
					break;
				}
				case SDL_WINDOWEVENT:
				{
					SDL_WindowEvent *w = (SDL_WindowEvent*)&e;
					printf("window event %u %u\n", w->type, w->event);
					if (w->event == SDL_WINDOWEVENT_FOCUS_LOST)
					{
						//
					}
					break;
				}
				default:
				{
					break;
				}
			}
		}
	}

	void resize(const Vector2& newSize)
	{
		printf("Game::resize %4.2f x %4.2f\n", newSize.x, newSize.y);
		screenSize = newSize;
	}

	void loop()
	{
		count += 1;
		double currentTime = emscripten_get_now();

		Engine_FillPage();
		float screenWidth = getCanvasWidth();
		float screenHeight = getCanvasHeight();
		if (screenWidth != screenSize.x || screenHeight != screenSize.y)
		{
			resize(Vector2(screenWidth, screenHeight));
		}
		
		pollEvents();
		draw(currentTime, count);
		
		lastTime = currentTime;
	}
};




