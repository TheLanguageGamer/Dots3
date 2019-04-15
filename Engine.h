#pragma once

///Users/jhelms/projects/emsdk/emscripten/1.38.27/emcc main.cpp -std=c++11 -O2 -I../../ -s WASM=0 -s --js-library ../../library_engine.js -s ASSERTIONS=2 -o main.js

#include <vector>
#include <unordered_map>
#include <string>
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
	extern float Engine_MeasureTextWidth(const char* text, float fontSize);
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
	Component,
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

struct Vector2Int
{
	int32_t x;
	int32_t y;
	Vector2Int()
	: x(0)
	, y(0) {}
	Vector2Int(int32_t x, int32_t y)
	: x(x)
	, y(y) {}
};

std::vector<std::string> idToString;
std::unordered_map<std::string, uint32_t> stringToId;

struct Entity
{
	Vector2 coord1;
	Vector2 coord2;
	Vector2 coord3;
	Vector2 coord4;
	uint32_t id1;
	uint32_t id2;
	uint32_t id3;
	Type type;

	Entity()
	: id1(0)
	, id2(0)
	, type(Type::None) {}

	static uint32_t getIdForText(const std::string& text)
	{
		if (stringToId.find(text) == stringToId.end())
		{
			uint32_t id = idToString.size();
			idToString.push_back(text);
			stringToId[text] = id;
		}
		return stringToId[text];
	}

	static const std::string& getTextForId(uint32_t id)
	{
		return idToString[id];
	}

	static Entity text(
		const std::string& text,
		const Vector2& position,
		float fontSize,
		uint32_t rgba)
	{
		Entity entity;
		entity.type = Type::Text;
		entity.coord1 = position;
		entity.coord4.x = fontSize;
		entity.id1 = rgba;
		entity.id2 = getIdForText(text);
		float width = Engine_MeasureTextWidth(text.c_str(), fontSize);
		float height = fontSize;
		entity.coord3 = Vector2(width, height);
		return entity;
	}

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
		entity.type = Type::Rectangle;
		entity.coord1 = position;
		entity.coord3 = size;
		entity.id1 = rgba;
		return entity;
	}

	static Entity roundedRectangle(
		const Vector2& position,
		const Vector2& size,
		float radius,
		float thickness,
		uint32_t strokeRgba,
		uint32_t fillRgba)
	{
		Entity entity;
		entity.type = Type::RoundedRectangle;
		entity.coord1 = position;
		entity.coord3 = size;
		entity.coord4 = Vector2(radius, thickness);
		entity.id1 = strokeRgba;
		entity.id2 = fillRgba;
		return entity;
	}

	static Entity component()
	{
		Entity entity;
		entity.type = Type::Component;
		return entity;
	}
};

struct Component
{
	enum SizeMode
	{
		SizeMode_Normal,
		SizeMode_FixedAspectRatio,
	};
	int32_t startIndex;
	int32_t endIndex;
	Vector2 anchorPoint;
	Vector2 screenPosition;
	Vector2 screenSize;
	float aspectRatio;
	SizeMode sizeMode;
	std::vector<std::shared_ptr<Component>> children;
	Component(std::vector<Entity>& entities)
	: startIndex(entities.size())
	, endIndex(entities.size())
	, aspectRatio(0.0f)
	, sizeMode(SizeMode_Normal)
	{
		addEntity(entities, Entity::component());
	}

	void addEntity(std::vector<Entity>& entities, const Entity& entity)
	{
		//assert entities.size() == endIndex + 1
		endIndex = entities.size();
		entities.push_back(entity);
	}

	virtual void addChild(std::shared_ptr<Component> child)
	{
		//assert child.startIndex == this->endIndex + 1;
		endIndex = child->endIndex;
		children.push_back(child);
	}

	void setRelativePosition(std::vector<Entity>& entities, const Vector2& position)
	{
		entities[startIndex].coord1 = position;
	}
	void setRelativeSize(std::vector<Entity>& entities, const Vector2& size)
	{
		entities[startIndex].coord2 = size;
	}
	void setOffsetPosition(std::vector<Entity>& entities, const Vector2& position)
	{
		entities[startIndex].coord3 = position;
	}
	void setOffsetSize(std::vector<Entity>& entities, const Vector2& size)
	{
		entities[startIndex].coord4 = size;
	}
	void setAnchorPoint(std::vector<Entity>& entities, const Vector2& newAnchorPoint)
	{
		anchorPoint = newAnchorPoint;
	}

	const Vector2& getRelativePosition(std::vector<Entity>& entities)
	{
		return entities[startIndex].coord1;
	}
	const Vector2& getRelativeSize(std::vector<Entity>& entities)
	{
		return entities[startIndex].coord2;
	}
	const Vector2& getOffsetPosition(std::vector<Entity>& entities)
	{
		return entities[startIndex].coord3;
	}
	const Vector2& getOffsetSize(std::vector<Entity>& entities)
	{
		return entities[startIndex].coord4;
	}

	void applySizeMode()
	{
		switch (sizeMode)
		{
			case SizeMode_Normal:
			{
				break;
			}
			case SizeMode_FixedAspectRatio:
			{			
				float aspectWidth = screenSize.y*aspectRatio;
				float aspectHeight = screenSize.x/aspectRatio;
				if (aspectWidth < screenSize.x)
				{
					screenSize = Vector2(aspectWidth, screenSize.y);
				}
				else
				{
					screenSize = Vector2(screenSize.x, aspectHeight);
				}
				break;
			}
		}
	}

	void doLayoutCommon(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize)
	{
		const Vector2& relativeSize = getRelativeSize(entities);
		const Vector2& offsetSize = getOffsetSize(entities);
		const Vector2& relativePosition = getRelativePosition(entities);
		const Vector2& offsetPosition = getOffsetPosition(entities);

		float newWidth = relativeSize.x*parentSize.x + offsetSize.x;
		float newHeight = relativeSize.y*parentSize.y + offsetSize.y;

		screenSize = Vector2(newWidth, newHeight);
		applySizeMode();

		float newX = parentPosition.x + (parentSize.x)*relativePosition.x - anchorPoint.x*screenSize.x + offsetPosition.x;
		float newY = parentPosition.y + (parentSize.y)*relativePosition.y - anchorPoint.y*screenSize.y + offsetPosition.y;

		screenPosition = Vector2(newX, newY);

		applySizeMode();
	}

	virtual void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize)
	{
		doLayoutCommon(entities, parentPosition, parentSize);

		for (auto child : children)
		{
			child->doLayout(entities, screenPosition, screenSize);
		}
	}
};

struct DrawComponent : Component
{
	DrawComponent(std::vector<Entity>& entities)
	: Component(entities)
	{

	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		printf("Component::doLayout %4.2f x %4.2f, %4.2f x %4.2f\n", screenPosition.x, screenPosition.y, screenSize.x, screenSize.y);
		for (int32_t index = startIndex + 1; index <= endIndex; ++index)
		{
			Entity& entity = entities[index];
			switch (entity.type)
			{
				case Type::Circle:
				case Type::Rectangle:
				case Type::RoundedRectangle:
				case Type::Text:
				{
					const Vector2& position = entity.coord1;
					const Vector2& size = entity.coord3;

					float xPercentage = (position.x - oldScreenPosition.x)/oldScreenSize.x;
					float yPercentage = (position.y - oldScreenPosition.y)/oldScreenSize.y;
					float newX = screenPosition.x + xPercentage*screenSize.x;
					float newY = screenPosition.y + yPercentage*screenSize.y;

					entity.coord1 = Vector2(newX, newY);
					//printf("entity: %4.2f x %4.2f\n", newX, newY);

					if (entities[index].type == Type::Text)
					{
						break;
					}

					float newWidth = (size.x/oldScreenSize.x)*screenSize.x;
					float newHeight = (size.y/oldScreenSize.y)*screenSize.y;

					entity.coord3 = Vector2(newWidth, newHeight);

					break;
				}
				default:
				{
					break;
				}
			}
		}

		for (auto child : children)
		{
			child->doLayout(entities, screenPosition, screenSize);
		}
	}
};

struct RectangleComponent : DrawComponent
{
	RectangleComponent(std::vector<Entity>& entities, uint32_t rgba)
	: DrawComponent(entities)
	{
		addEntity(entities, Entity::rectangle(Vector2(), Vector2(), rgba));
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);

		Entity& rectangle = entities[startIndex+1];
		rectangle.coord1 = screenPosition;
		rectangle.coord3 = screenSize;

		for (auto child : children)
		{
			child->doLayout(entities, screenPosition, screenSize);
		}
	}
};

struct TextComponent : DrawComponent
{
	TextComponent(
		std::vector<Entity>& entities,
		const std::string& text,
		uint32_t rgba,
		float fontSize)
	: DrawComponent(entities)
	{
		Entity textEntity = Entity::text(text, Vector2(), fontSize, rgba);
		addEntity(entities, textEntity);
		setOffsetSize(entities, textEntity.coord3);
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);

		Entity& textEntity = entities[startIndex+1];
		textEntity.coord1 = screenPosition;

		for (auto child : children)
		{
			child->doLayout(entities, screenPosition, screenSize);
		}
	}
};

struct EntityGrid : DrawComponent
{
	Vector2Int matrixSize;

	EntityGrid(
		std::vector<Entity>& entities,
		Vector2Int matrixSize)
	: DrawComponent(entities)
	, matrixSize(matrixSize)
	{
		float cellSpacing = 10.0f;
		float padding = 2.0f;
		for (int32_t i = 0; i < matrixSize.x; ++i)
		{
			for(int32_t j = 0; j < matrixSize.y; ++j)
			{
				entities.push_back(Entity::roundedRectangle(
					Vector2(i*cellSpacing, j*cellSpacing),
					Vector2(cellSpacing - padding, cellSpacing - padding),
					3.0f,
					1.0f,
					0xFFFFFFFF,
					0x55FFBB00
				));
			}
		}
		endIndex = entities.size() - 1;
		screenSize = Vector2(matrixSize.x*cellSpacing, matrixSize.y*cellSpacing);
		aspectRatio = (float)matrixSize.x/(float)matrixSize.y;
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

struct Screen
{
	std::vector<Entity> entities;
	std::shared_ptr<struct Component> rootComponent;
	Vector2 size;

	Screen()
	: rootComponent(nullptr) {}

	void onResize(const Vector2& newSize)
	{
		size = newSize;
		if (rootComponent)
		{
			rootComponent->doLayout(entities, Vector2(), newSize);
		}
	}
};

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
	std::shared_ptr<Screen> screen;

	void setScreen(std::shared_ptr<Screen> newScreen)
	{
		screen = newScreen;
		screen->onResize(screenSize);
	}

	void draw(double currentTime, uint64_t count)
	{
		std::vector<Entity> entities = screen->entities;
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
					Engine_FilledRectangle(
						entity.coord1.x,
						entity.coord1.y,
						entity.coord3.x,
						entity.coord3.y,
						entity.id1);
					break;
				}
				case Type::RoundedRectangle:
				{
					Engine_RoundedRectangle(
						entity.coord1.x,
						entity.coord1.y,
						entity.coord3.x,
						entity.coord3.y,
						entity.coord4.x,
						entity.coord4.y,
						entity.id1,
						entity.id2);
					break;
				}
				case Type::Text:
				{
					const std::string& text = Entity::getTextForId(entity.id2);
					Engine_FilledText(
						text.c_str(),
						entity.coord1.x,
						entity.coord1.y + entity.coord4.x,
						entity.coord4.x,
						entity.id1);
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

	void resize()
	{

		Engine_FillPage();
		float screenWidth = getCanvasWidth();
		float screenHeight = getCanvasHeight();
		if (screenWidth == screenSize.x && screenHeight == screenSize.y)
		{
			return;
		}
		const Vector2 newSize = Vector2(screenWidth, screenHeight);
		printf("Game::resize %4.2f x %4.2f\n", newSize.x, newSize.y);
		screenSize = newSize;
		//screen->rootComponent->doLayout(screen->entities, Vector2(), screenSize);
		screen->onResize(screenSize);
	}

	void loop()
	{
		count += 1;
		double currentTime = emscripten_get_now();
		
		resize();
		pollEvents();
		draw(currentTime, count);
		
		lastTime = currentTime;
	}
};




