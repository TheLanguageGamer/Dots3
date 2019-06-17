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
	extern void Engine_StrokeEllipse(float x, float y, float width, float height, float thickness, uint32_t rgba);
	extern void Engine_FilledRectangle(float x, float y, float width, float height, uint32_t rgba);
	extern void Engine_StrokeRectangle(float x, float y, float width, float height, float thickness, uint32_t rgba);
	extern void Engine_Rectangle(
		float x, float y,
		float width, float height,
		float thickness,
		uint32_t stroke, uint32_t fill);
	extern void Engine_FilledText(const char* text, float x, float y, float fontSize, uint32_t rgba);
	extern float Engine_MeasureTextWidth(const char* text, float fontSize);
	extern float Engine_MeasureTextHeight(const char* text, float fontSize);
	extern void Engine_Image(const char* name, float x, float y, float width, float height, uint32_t rgba);
	extern void Engine_RoundedRectangle(
		float x, float y,
		float width, float height,
		float radius, float thickness,
		uint32_t strokeRgba, uint32_t fillRgba);
	extern void Engine_RegisterSound(const char* path);
	extern void Engine_PlaySound(const char* path);
	extern bool Engine_SpellCheck(const char* text);
}

enum Type
{
	None,
	Component,
	FillCircle,
	StrokeCircle,
	Rectangle,
	FillRectangle,
	StrokeRectangle,
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

	static float distance(const Vector2& v1, const Vector2& v2)
	{
		return sqrtf((v2.x-v1.x)*(v2.x-v1.x) + (v2.y-v1.y)*(v2.y-v1.y));
	}
};

Vector2 operator* (float c, const Vector2& v)
{
    return Vector2(c*v.x, c*v.y);
}

Vector2 operator* (const Vector2& v, float c)
{
    return Vector2(c*v.x, c*v.y);
}

Vector2 operator+ (const Vector2& v1, const Vector2& v2)
{
    return Vector2(v1.x + v2.x, v1.y + v2.y);
}

Vector2 operator- (const Vector2& v1, const Vector2& v2)
{
    return Vector2(v1.x - v2.x, v1.y - v2.y);
}

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

struct BoxInt
{
	Vector2Int position;
	Vector2Int size;
	BoxInt(const Vector2Int& position, const Vector2Int& size)
	: position(position)
	, size(size) {}
};

struct Rect2D
{
	Vector2 minPoint;
	Vector2 maxPoint;

	Rect2D(const Vector2& minPoint, const Vector2& maxPoint)
	: minPoint(minPoint)
	, maxPoint(maxPoint) {}
};

static bool doesPointIntersectRect(const Vector2& point,
								   const Vector2& rectPosition,
								   const Vector2& rectSize)
{
	return point.x >= rectPosition.x
		   && point.x <= rectPosition.x + rectSize.x
		   && point.y >= rectPosition.y
		   && point.y <= rectPosition.y + rectSize.y; 
}

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
	, id3(0)
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

	static Entity image(
		const std::string& filename,
		const Vector2& position,
		const Vector2& size)
	{
		Entity entity;
		entity.type = Type::Image;
		entity.coord1 = position;
		entity.coord3 = size;
		entity.id2 = getIdForText(filename);
		entity.id1 = 0xFFFFFFFF;
		return entity;
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

	static float getFontSize(const Entity& entity)
	{
		//assert entity.type == Type::Text
		return entity.coord4.x;
	}

	static void setFontSize(Entity& entity, float fontSize)
	{
		//assert entity.type == Type::Text
		const std::string& text = Entity::getText(entity);
		entity.coord4.x = fontSize;
		float width = Engine_MeasureTextWidth(text.c_str(), fontSize);
		float height = fontSize;
		entity.coord3 = Vector2(width, height);
	}

	static const std::string& getText(const Entity& entity)
	{
		//assert entity.type == Type::Text
		return getTextForId(entity.id2);
	}

	static void setText(Entity& entity, const std::string& text)
	{
		switch (entity.type)
		{
			case Type::Text:
			{
				entity.id2 = getIdForText(text);
				float width = Engine_MeasureTextWidth(text.c_str(), entity.coord3.y);
				entity.coord3.x = width;
				break;
			}
			default:
			{
				//assert false
				break;
			}
		}
	}

	static void setImage(Entity& entity, const std::string& text)
	{
		switch (entity.type)
		{
			case Type::Image:
			{
				entity.id2 = getIdForText(text);
				break;
			}
			default:
			{
				//assert false
				break;
			}
		}
	}

	static Entity fillCircle(
		const Vector2& position,
		float radius,
		uint32_t rgba)
	{
		Entity entity;
		entity.type = Type::FillCircle;
		entity.coord1 = position;
		entity.coord3 = Vector2(radius, radius);
		entity.id1 = rgba;
		return entity;
	}

	static Entity strokeCircle(
		const Vector2& position,
		float radius,
		float thickness,
		uint32_t rgba)
	{
		Entity entity;
		entity.type = Type::StrokeCircle;
		entity.coord1 = position;
		entity.coord3 = Vector2(radius, radius);
		entity.coord4 = Vector2(thickness, 0.0f);
		entity.id1 = rgba;
		return entity;
	}

	static Entity rectangle(
		const Vector2& position,
		const Vector2& size,
		float thickness,
		uint32_t stroke,
		uint32_t fill)
	{
		Entity entity;
		entity.type = Type::Rectangle;
		entity.coord1 = position;
		entity.coord3 = size;
		entity.id1 = stroke;
		entity.id2 = fill;
		return entity;
	}

	static Entity fillRectangle(
		const Vector2& position,
		const Vector2& size,
		uint32_t rgba)
	{
		Entity entity;
		entity.type = Type::FillRectangle;
		entity.coord1 = position;
		entity.coord3 = size;
		entity.id2 = rgba;
		return entity;
	}

	static Entity strokeRectangle(
		const Vector2& position,
		const Vector2& size,
		float thickness,
		uint32_t rgba)
	{
		Entity entity;
		entity.type = Type::StrokeRectangle;
		entity.coord1 = position;
		entity.coord3 = size;
		entity.coord4 = Vector2(thickness, 0.0f);
		entity.id2 = rgba;
		return entity;
	}

	static void setStrokeColor(Entity& entity, const uint32_t fillRgba)
	{
		switch (entity.type)
		{
			case Type::StrokeRectangle:
			{
				entity.id2 = fillRgba;
				break;
			}
			default:
			{
				//assert false
				break;
			}
		}
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

	static void setFillColor(Entity& entity, const uint32_t fillRgba)
	{
		switch (entity.type)
		{
			case Type::Rectangle:
			case Type::FillRectangle:
			case Type::RoundedRectangle:
			{
				entity.id2 = fillRgba;
				break;
			}
			case Type::Text:
			case Type::Image:
			{
				entity.id1 = fillRgba;
				break;
			}
			default:
			{
				//assert false
				break;
			}
		}
	}

	static uint32_t getFillColor(Entity& entity)
	{
		switch (entity.type)
		{
			case Type::Rectangle:
			case Type::FillRectangle:
			case Type::RoundedRectangle:
			{
				return entity.id2;
			}
			default:
			{
				//assert false
				break;
			}
		}
		return 0;
	}

	static uint32_t getFillAlpha(Entity& entity)
	{
		switch (entity.type)
		{
			case Type::Rectangle:
			case Type::FillRectangle:
			case Type::RoundedRectangle:
			{
				return entity.id2 & 0xFF;
			}
			case Type::Text:
			case Type::Image:
			{
				return entity.id1 & 0xFF;
			}
			default:
			{
				//assert false
				break;
			}
		}
		return 0;
	}

	static void setFillAlpha(Entity& entity, const uint32_t alpha)
	{
		switch (entity.type)
		{
			case Type::Rectangle:
			case Type::FillRectangle:
			case Type::RoundedRectangle:
			{
				entity.id2 = (0xFFFFFF00&(entity.id2)) + alpha;
				break;
			}
			case Type::Text:
			case Type::Image:
			{
				entity.id1 = (0xFFFFFF00&(entity.id1)) + alpha;
				break;
			}
			default:
			{
				//assert false
				break;
			}
		}
	}

	static void setStrokeAlpha(Entity& entity, const uint32_t alpha)
	{
		switch (entity.type)
		{
			case Type::Rectangle:
			case Type::RoundedRectangle:
			{
				entity.id1 = (0xFFFFFF00&(entity.id2)) + alpha;
				break;
			}
			default:
			{
				//assert false
				break;
			}
		}
	}

	static void setAlpha(Entity& entity, const uint32_t alpha)
	{
		if (alpha > 0xFF)
		{
			printf("weird alpha: %u\n", alpha);
		}
		Entity::setFillAlpha(entity, alpha);
		Entity::setStrokeAlpha(entity, alpha);
	}

	static void setPosition(Entity& entity, const Vector2& position)
	{
		switch (entity.type)
		{
			case Type::RoundedRectangle:
			case Type::Rectangle:
			case Type::StrokeCircle:
			case Type::FillCircle:
			case Type::Text:
			{
				entity.coord1 = position;
				break;
			}
			default:
			{
				//assert false
				break;
			}
		}
	}

	static void setSize(Entity& entity, const Vector2& size)
	{
		switch (entity.type)
		{
			case Type::RoundedRectangle:
			case Type::Rectangle:
			case Type::StrokeCircle:
			case Type::FillCircle:
			{
				entity.coord3 = size;
				break;
			}
			default:
			{
				//assert false
				break;
			}
		}
	}

	static Entity component(uint32_t startIndex)
	{
		Entity entity;
		entity.type = Type::Component;
		entity.id1 = startIndex;
		entity.id3 = 1;
		return entity;
	}
};

struct Movement
{
	bool isComplete = false;
	bool isDisabled = false;
	std::function<void()> onComplete = nullptr;
	virtual void onStep(std::vector<Entity>& entity, float timeDelta) {}
	void doComplete()
	{
		isDisabled = true;
		if (onComplete)
		{
			onComplete();
		}
	}
};

struct Component
{
	enum SizeMode
	{
		SizeMode_Normal,
		SizeMode_FixedAspectRatio,
		SizeMode_SizeToContents,
		SizeMode_WidthToContents,
	};
	enum PositionMode
	{
		PositionMode_Normal,
		PositionMode_HorizontalBlock,
		PositionMode_VerticalBlock,
	};
	int32_t _startIndex;
	// int32_t endIndex;
	Vector2 anchorPoint;
	Vector2 screenPosition;
	Vector2 screenSize;
	uint32_t alpha;
	Vector2 cachedParentSize;
	Vector2 cachedParentPosition;
	float aspectRatio;
	SizeMode _sizeMode;
	PositionMode positionMode;

	bool isDraggable;
	bool isDragging;
	std::function<void(Vector2& offsetPosition)> clampOffset;
	std::function<void()> onDraggingStarted;
	std::function<void()> onDraggingStopped;

	bool isClickable;
	bool isSelected;
	std::function<void()> onSelect;
	std::function<void()> onDeselect;
	std::function<void(const Vector2&)> onClick;

	bool isDrawable;
	bool isDrawing;
	std::function<void(const Vector2&)> onDrawingBegan;
	std::function<void(const Vector2&)> onDrawingMoved;
	std::function<void(const Vector2&)> onDrawingEnded;

	std::shared_ptr<Movement> movement;

	std::vector<std::shared_ptr<Component>> children;
	Component(std::vector<Entity>& entities)
	: _startIndex(entities.size())
	// , endIndex(entities.size())
	, aspectRatio(0.0f)
	, _sizeMode(SizeMode_Normal)
	, positionMode(PositionMode_Normal)
	, isDraggable(false)
	, isDragging(false)
	, isClickable(false)
	, isSelected(false)
	, isDrawable(false)
	, alpha(0xFF)
	{
		_startIndex = entities.size();
		entities.push_back(Entity::component(_startIndex));
		setEndIndex(entities, entities.size()-1);
		//printf("Component initialized3: %d -> %d\n", getStartIndex(entities), getEndIndex(entities));
	}

	Vector2 upperLeft()
	{
		return screenPosition;
	}

	Vector2 bottomLeft()
	{
		return Vector2(screenPosition.x, screenPosition.y + screenSize.y);
	}

	Vector2 upperRight()
	{
		return Vector2(screenPosition.x + screenSize.y, screenPosition.y);
	}

	virtual void setSizeMode(std::vector<Entity>& entities, SizeMode sizeMode)
	{
		_sizeMode = sizeMode;
	}

	Vector2 bottomRight()
	{
		return Vector2(screenPosition.x + screenSize.y, screenPosition.y + screenSize.y);
	}

	uint32_t getStartIndex(std::vector<Entity>& entities)
	{
		return entities[_startIndex].id1;
	}

	uint32_t getEndIndex(std::vector<Entity>& entities)
	{
		return entities[_startIndex].id2;
	}

	uint32_t getAlpha(std::vector<Entity>& entities)
	{
		return alpha;
	}

	void setAlpha(std::vector<Entity>& entities, uint32_t inAlpha)
	{
		alpha = inAlpha;
		uint32_t endIndex = getEndIndex(entities);
		for (uint32_t i = _startIndex; i <= endIndex; ++i)
		{
			Entity::setAlpha(entities[i], alpha);
		}
	}

	void setStartIndex(std::vector<Entity>& entities, uint32_t startIndex)
	{
		_startIndex = startIndex;
		entities[_startIndex].id1 = startIndex;
	}

	void setEndIndex(std::vector<Entity>& entities, uint32_t endIndex)
	{
		entities[_startIndex].id2 = endIndex;
	}

	void updateStartIndex(std::vector<Entity>& entities, uint32_t startIndex)
	{
		int32_t delta = startIndex - _startIndex;
		setStartIndex(entities, startIndex);
		setEndIndex(entities, getEndIndex(entities) + delta);
		for (auto child : children)
		{
			uint32_t childStartIndex = child->_startIndex + delta;
			child->updateStartIndex(entities, childStartIndex);
		}
	}

	bool isEnabled(std::vector<Entity>& entities)
	{
		return entities[_startIndex].id3 != 0;
	}

	void enable(std::vector<Entity>& entities)
	{
		entities[_startIndex].id3 = 1;
	}

	void disable(std::vector<Entity>& entities)
	{
		isDragging = false;
		isSelected = false;
		isDrawing = false;
		entities[_startIndex].id3 = 0;
	}

	void addEntity(std::vector<Entity>& entities, const Entity& entity)
	{
		//assert entities.size() == endIndex + 1
		setEndIndex(entities, entities.size());
		entities.push_back(entity);
	}

	virtual void addChild(std::vector<Entity>& entities, std::shared_ptr<Component> child)
	{
		//assert child.startIndex == this->endIndex + 1;
		setEndIndex(entities, child->getEndIndex(entities));
		children.push_back(child);
	}

	void setRelativePosition(std::vector<Entity>& entities, const Vector2& position)
	{
		entities[_startIndex].coord1 = position;
	}
	void setRelativeSize(std::vector<Entity>& entities, const Vector2& size)
	{
		entities[_startIndex].coord2 = size;
	}
	void setOffsetPosition(std::vector<Entity>& entities, const Vector2& position)
	{
		entities[_startIndex].coord3 = position;
	}
	void setOffsetSize(std::vector<Entity>& entities, const Vector2& size)
	{
		entities[_startIndex].coord4 = size;
	}
	void setAnchorPoint(std::vector<Entity>& entities, const Vector2& newAnchorPoint)
	{
		anchorPoint = newAnchorPoint;
	}

	const Vector2& getRelativePosition(std::vector<Entity>& entities)
	{
		return entities[_startIndex].coord1;
	}
	const Vector2& getRelativeSize(std::vector<Entity>& entities)
	{
		return entities[_startIndex].coord2;
	}
	const Vector2& getOffsetPosition(std::vector<Entity>& entities)
	{
		return entities[_startIndex].coord3;
	}
	const Vector2& getOffsetSize(std::vector<Entity>& entities)
	{
		return entities[_startIndex].coord4;
	}
	const Vector2& getAnchorPoint(std::vector<Entity>& entities)
	{
		return anchorPoint;
	}

	void relayout(std::vector<Entity>& entities)
	{
		const Vector2& relativeSize = getRelativeSize(entities);
		doLayout(entities, cachedParentPosition, cachedParentSize);
	}

	void applySizeMode()
	{
		switch (_sizeMode)
		{
			case SizeMode_Normal:
			case SizeMode_SizeToContents:
			case SizeMode_WidthToContents:
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

	static Vector2 impliedPosition(
		const Vector2& parentPosition,
		const Vector2& parentSize,
		const Vector2& relativeSize,
		const Vector2& offsetSize,
		const Vector2& relativePosition,
		const Vector2& offsetPosition,
		const Vector2& anchorPoint)
	{
		//printf("doLayoutCommon %4.2f x %4.2f, %4.2f x %4.2f, %4.2f x %4.2f\n", parentSize.x, parentSize.y, offsetSize.x, offsetSize.y, relativeSize.x, relativeSize.y);

		float newWidth = relativeSize.x*parentSize.x + offsetSize.x;
		float newHeight = relativeSize.y*parentSize.y + offsetSize.y;
		//printf("new: %4.2f x %4.2f\n", newWidth, newHeight);

		const Vector2 screenSize = Vector2(newWidth, newHeight);
		//applySizeMode();

		float newX = parentPosition.x + (parentSize.x)*relativePosition.x - anchorPoint.x*screenSize.x + offsetPosition.x;
		float newY = parentPosition.y + (parentSize.y)*relativePosition.y - anchorPoint.y*screenSize.y + offsetPosition.y;
		//printf("jhelms doLayoutCommon %4.2f, %4.2f, %4.2f, %4.2f, %4.2f\n", newX, parentPosition.x, relativePosition.x, screenSize.x, offsetSize.x);
		return Vector2(newX, newY);
	}

	void doLayoutCommon(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize)
	{
		cachedParentPosition = parentPosition;
		cachedParentSize = parentSize;
		const Vector2& relativeSize = getRelativeSize(entities);
		const Vector2& offsetSize = getOffsetSize(entities);
		const Vector2& relativePosition = getRelativePosition(entities);
		const Vector2& offsetPosition = getOffsetPosition(entities);
		//printf("doLayoutCommon %4.2f x %4.2f, %4.2f x %4.2f, %4.2f x %4.2f\n", parentSize.x, parentSize.y, offsetSize.x, offsetSize.y, relativeSize.x, relativeSize.y);

		float newWidth = relativeSize.x*parentSize.x + offsetSize.x;
		float newHeight = relativeSize.y*parentSize.y + offsetSize.y;
		//printf("new: %4.2f x %4.2f\n", newWidth, newHeight);

		screenSize = Vector2(newWidth, newHeight);
		applySizeMode();

		float newX = parentPosition.x + (parentSize.x)*relativePosition.x - anchorPoint.x*screenSize.x + offsetPosition.x;
		float newY = parentPosition.y + (parentSize.y)*relativePosition.y - anchorPoint.y*screenSize.y + offsetPosition.y;
		// printf("jhelms doLayoutCommon %4.2f, %4.2f, %4.2f, %4.2f, %4.2f\n",
		// 	newX, parentPosition.x, relativeSize.x, screenSize.x, offsetSize.x);
		screenPosition = Vector2(newX, newY);

		// applySizeMode();
	}

	void convertOffsetToRelativePosition(std::vector<Entity>& entities)
	{
		const Vector2& relativePosition = getRelativePosition(entities);
		const Vector2& offsetPosition = getOffsetPosition(entities);

		float relativeDeltaX = offsetPosition.x/cachedParentSize.x;
		float relativeDeltaY = offsetPosition.y/cachedParentSize.y;

		Vector2 newRelativePosition(relativePosition.x + relativeDeltaX, relativePosition.y + relativeDeltaY);
		setRelativePosition(entities, newRelativePosition);
		setOffsetPosition(entities, Vector2());
	}

	Rect2D doLayoutChildren(std::vector<Entity>& entities)
	{
		Vector2 minPoint;
		Vector2 maxPoint;
		Vector2 effectiveScreenPosition = screenPosition;
		for (auto child : children)
		{
			if (positionMode == PositionMode_VerticalBlock)
			{
				child->doLayout(entities, effectiveScreenPosition, screenSize);
				effectiveScreenPosition.y = child->screenPosition.y + child->screenSize.y;
			}
			else if (positionMode == PositionMode_HorizontalBlock)
			{
				child->doLayout(entities, effectiveScreenPosition, screenSize);
				effectiveScreenPosition.x = child->screenPosition.x + child->screenSize.x;
			}
			else
			{
				child->doLayout(entities, screenPosition, screenSize);
			}
			minPoint.x = std::min(minPoint.x, child->screenPosition.x);
			minPoint.y = std::min(minPoint.y, child->screenPosition.y);
			maxPoint.x = std::max(maxPoint.x, child->screenPosition.x+child->screenSize.x);
			maxPoint.y = std::max(maxPoint.y, child->screenPosition.y+child->screenSize.y);
		}

		return Rect2D(minPoint, maxPoint);
	}

	virtual void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize)
	{
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutChildren(entities);
	}

	virtual void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldParentPosition,
		const Vector2& oldParentSize)
	{

	}

	void doStep(std::vector<Entity>& entities, float timeDelta)
	{
		if (!isEnabled(entities))
		{
			return;
		}
		
		if (movement && !movement->isDisabled)
		{
			bool wasComplete = movement->isComplete;
			movement->onStep(entities, timeDelta);
			if (!wasComplete)
			{
				relayout(entities);
			}
			else
			{
				movement->doComplete();
			}
		}

		for (auto child : children)
		{
			child->doStep(entities, timeDelta);
		}
	}

	void enableDragging(
		std::function<void(Vector2& offsetPosition)> inClampOffset,
		std::function<void()> inOnDraggingStarted,
		std::function<void()> inOnDraggingStopped)
	{
		clampOffset = inClampOffset;
		onDraggingStarted = inOnDraggingStarted;
		onDraggingStopped = inOnDraggingStopped;
		isDraggable = true;
	}

	void disableDragging()
	{
		clampOffset = nullptr;
		onDraggingStarted = nullptr;
		onDraggingStopped = nullptr;
		isDraggable = false;
	}

	void onDrag(std::vector<Entity>& entities, const Vector2& delta)
	{
		//printf("dragging %p\n", this);
		const Vector2& offsetPosition = getOffsetPosition(entities);
		Vector2 newOffsetPosition = Vector2(offsetPosition.x + delta.x, offsetPosition.y + delta.y);
		if (clampOffset)
		{
			clampOffset(newOffsetPosition);
		}
		//const Vector2 impliedDelta(newOffsetPosition.x - offsetPosition.x, newOffsetPosition.y - offsetPosition.y);
		setOffsetPosition(entities, newOffsetPosition);
		//const Vector2 oldScreenPosition = screenPosition;
		// screenPosition = Vector2(screenPosition.x + impliedDelta.x, screenPosition.y + impliedDelta.y);
		// doLayoutEntities(entities, oldScreenPosition, screenSize);
		// doLayoutChildren(entities);
		relayout(entities);
	}

	void enableClicking(
		std::function<void()> inOnSelect,
		std::function<void()> inOnDeselect,
		std::function<void(const Vector2&)> inOnClick)
	{
		onSelect = inOnSelect;
		onDeselect = inOnDeselect;
		onClick = inOnClick;
		isClickable = true;
	}

	void enableDrawing(
		std::function<void(const Vector2&)> inOnDrawingBegan,
		std::function<void(const Vector2&)> inOnDrawingMoved,
		std::function<void(const Vector2&)> inOnDrawingEnded)
	{
		onDrawingBegan = inOnDrawingBegan;
		onDrawingMoved = inOnDrawingMoved;
		onDrawingEnded = inOnDrawingEnded;
		isDrawable = true;
	}

	bool onMouseMove(
		std::vector<Entity>& entities,
		const Vector2& position,
		const Vector2& delta)
	{
		if (!isEnabled(entities))
		{
			return false;
		}
		if (isDragging)
		{
			onDrag(entities, delta);
			return true;
		}
		if (isDrawing)
		{
			if (onDrawingMoved)
			{
				onDrawingMoved(position);
				return true;
			}
		}

		for (int32_t i = children.size()-1; i >= 0; --i)
		{
			std::shared_ptr<Component> child = children[i];
			if (child->onMouseMove(entities, position, delta))
			{
				return true;
			}
		}
		return false;
	}

	bool onMouseButton1Down(std::vector<Entity>& entities, const Vector2& position)
	{
		if (!isEnabled(entities))
		{
			return false;
		}
		for (int32_t i = children.size()-1; i >= 0; --i)
		{
			std::shared_ptr<Component> child = children[i];
			if (child->onMouseButton1Down(entities, position))
			{
				return true;
			}
		}

		if (isDrawable
			&& doesPointIntersectRect(position, screenPosition, screenSize))
		{
			printf("onMouseButton1Down\n");
			isDrawing = true;
			if (onDrawingBegan)
			{
				onDrawingBegan(position);
			}
			return true;
		}

		if (isClickable
			&& doesPointIntersectRect(position, screenPosition, screenSize))
		{
			isSelected = true;
			if (onSelect)
			{
				onSelect();
			}
			return true;
		}

		if (isDraggable
			&& doesPointIntersectRect(position, screenPosition, screenSize))
		{
			printf("made draggable %p\n", this);
			if (onDraggingStarted)
			{
				onDraggingStarted();
			}
			isDragging = true;
			return true;
		}
		return false;
	}

	bool onMouseButton1Up(std::vector<Entity>& entities, const Vector2& position)
	{
		if (!isEnabled(entities))
		{
			return false;
		}
		if (isClickable && isSelected)
		{
			isSelected = false;
			if (onDeselect)
			{
				onDeselect();
			}
			if (onClick && doesPointIntersectRect(position, screenPosition, screenSize))
			{
				onClick(position);
			}
			return true;
		}
		if (isDraggable && isDragging)
		{
			if (onDraggingStopped)
			{
				onDraggingStopped();
			}
			isDragging = false;
			return true;
		}
		if (isDrawable && isDrawing)
		{
			if (onDrawingEnded)
			{
				onDrawingEnded(position);
			}
			isDrawing = false;
			return true;
		}

		for (int32_t i = children.size()-1; i >= 0; --i)
		{
			std::shared_ptr<Component> child = children[i];
			if (child->onMouseButton1Up(entities, position))
			{
				return true;
			}
		}
		return false;
	}
};

static void swapComponentEntities(
	std::vector<Entity>& entities,
	struct Component* component1,
	struct Component* component2)
{
	uint32_t start1 = component1->getStartIndex(entities);
	uint32_t end1 = component1->getEndIndex(entities);
	uint32_t start2 = component2->getStartIndex(entities);
	uint32_t end2 = component2->getEndIndex(entities);
	printf("swapComponentEntities %p %p, %u->%u : %u->%u\n", component1, component2, start1, end1, start2, end2);
	uint32_t length = end1 - start1;
	//assert end1-start1 == end2-start2
	for (int32_t indexDelta = 0; indexDelta <= length; ++indexDelta)
	{
		// Entity temp = entities[start1 + indexDelta];
		// entities[start1 + indexDelta] = entities[start2 + indexDelta];
		// entities[start2 + indexDelta] = temp;
		std::swap(entities[start1 + indexDelta], entities[start2 + indexDelta]);
	}
	// component1->setStartIndex(entities, start2);
	// component1->setEndIndex(entities, end2);
	// component2->setStartIndex(entities, start1);
	// component2->setEndIndex(entities, end1);
	component1->updateStartIndex(entities, start2);
	component2->updateStartIndex(entities, start1);
}

struct ComposeMovement : Movement
{
	std::vector<std::shared_ptr<Movement>> movements;

	void onStep(std::vector<Entity>& entities, float deltaTime) override
	{
		bool allComplete = true;
		for (auto movement : movements)
		{
			if (!movement->isComplete)
			{
				movement->onStep(entities, deltaTime);
				allComplete = false;
			}
		}
		isComplete = allComplete;
	}
};

struct SequentialMovement : Movement
{
	std::vector<std::shared_ptr<Movement>> movements;
	uint32_t index = 0;

	void onStep(std::vector<Entity>& entities, float deltaTime) override
	{
		if (movements.size() == 0 || isComplete)
		{
			isComplete = true;
			return;
		}

		auto movement = movements[index];
		movement->onStep(entities, deltaTime);

		if (movement->isComplete)
		{
			index++;
			if (index >= movements.size())
			{
				isComplete = true;
			}
		}
	}
};

struct SpringState1
{
	bool isComplete = true;
	double dampingRatio = 1.0f;
	double frequency = 3.0f*M_PI*2.0;
	double precision = 0.01f;
	double velocity = 0.0f;
	float destination = 0.0f;

	const float step(double deltaTime, const float current)
	{
		deltaTime /= 1000.0f;
		const double displacement = current - destination;

		//TODO: support under and over damped
		const double decay = exp(-deltaTime*dampingRatio*frequency);
		const float newPosition = (velocity*deltaTime + displacement*(frequency*deltaTime + 1))*decay + destination;
		const double newVelocity = (velocity - frequency*deltaTime*(displacement*frequency + velocity))*decay;

		if (newPosition > 1.0f || newPosition < 0.0f || current < 0.0f || current > 1.0f)
		{
			printf("bad position: %4.2f, %4.2f, %4.2f, %4.2f\n",
				newPosition, current, velocity, deltaTime);
		}

		if (fabs(newPosition-destination) < precision
			&& fabs(newVelocity) < precision
			&& deltaTime > 0.0f)
		{
			velocity = 0.0f;
			isComplete = true;
			return destination;
		}
		else
		{
			velocity = newVelocity;
			return newPosition;
		}
	}
};

struct SpringState2
{
	bool isComplete = true;
	float precision = 0.001f;
	double dampingRatio = 1.0f;
	double frequency = 3.0f*M_PI*2.0;
	Vector2 velocity;
	Vector2 destination;

	const Vector2 step(float deltaTime, const Vector2& current)
	{
		deltaTime /= 1000.0f;
		const Vector2 displacement = current - destination;

		//TODO: support under and over damped
		const double decay = exp(-deltaTime*dampingRatio*frequency);
		const Vector2 newPosition = (velocity*deltaTime + displacement*(frequency*deltaTime + 1))*decay + destination;
		const Vector2 newVelocity = (velocity - frequency*deltaTime*(displacement*frequency + velocity))*decay;

		if (fabs(newPosition.x-destination.x) < precision
			&& fabs(newPosition.y-destination.y) < precision
			&& fabs(newVelocity.x) < precision
			&& fabs(newVelocity.y) < precision
			&& deltaTime > 0.0f)
		{
			velocity = Vector2();
			isComplete = true;
			return destination;
		}
		else
		{
			velocity = newVelocity;
			return newPosition;
		}
	}
};

struct PropertyAnimation : Movement
{
	static const uint16_t RELATIVE_POSITION = 1;
	static const uint16_t RELATIVE_SIZE = 2;
	static const uint16_t OFFSET_POSITION = 4;
	static const uint16_t OFFSET_SIZE = 8;
	static const uint16_t ANCHOR_POINT = 16;
	static const uint16_t ALPHA = 32;

	bool disableOnComplete = false;

	PropertyAnimation(std::shared_ptr<struct Component> component)
	: component(component) {}

	void setRelativePosition(const Vector2& value)
	{
		relativePosition.destination = value;
		relativePosition.isComplete = false;
		isDisabled = false;
		isComplete = false;
		animatingProperties |= RELATIVE_POSITION;
	}
	void setRelativeSize(const Vector2& value)
	{
		relativeSize.destination = value;
		relativeSize.isComplete = false;
		isDisabled = false;
		isComplete = false;
		animatingProperties |= RELATIVE_SIZE;
	}
	void setOffsetPosition(const Vector2& value)
	{
		offsetPosition.destination = value;
		offsetPosition.isComplete = false;
		isDisabled = false;
		isComplete = false;
		animatingProperties |= OFFSET_POSITION;
	}
	void setOffsetSize(const Vector2& value)
	{
		offsetSize.destination = value;
		offsetSize.isComplete = false;
		isDisabled = false;
		isComplete = false;
		animatingProperties |= OFFSET_SIZE;
	}
	void setAnchorPoint(const Vector2& value)
	{
		anchorPoint.destination = value;
		anchorPoint.isComplete = false;
		isDisabled = false;
		isComplete = false;
		animatingProperties |= ANCHOR_POINT;
	}
	void setAlpha(float value)
	{
		alpha.destination = value;
		alpha.isComplete = false;
		isDisabled = false;
		isComplete = false;
		animatingProperties |= ALPHA;
	}

	void onStep(std::vector<Entity>& entities, float deltaTime) override
	{
		if ((animatingProperties & RELATIVE_POSITION) == RELATIVE_POSITION)
		{
			const Vector2 current = component->getRelativePosition(entities);
			Vector2 newValue = relativePosition.step(deltaTime, current);
			component->setRelativePosition(entities, newValue);
			if (relativePosition.isComplete)
			{
				animatingProperties &= ~RELATIVE_POSITION;
			}
		}
		if ((animatingProperties & RELATIVE_SIZE) == RELATIVE_SIZE)
		{
			const Vector2 current = component->getRelativeSize(entities);
			Vector2 newValue = relativeSize.step(deltaTime, current);
			component->setRelativeSize(entities, newValue);
			if (relativeSize.isComplete)
			{
				animatingProperties &= ~RELATIVE_SIZE;
			}
		}
		if ((animatingProperties & OFFSET_POSITION) == OFFSET_POSITION)
		{
			const Vector2 current = component->getOffsetPosition(entities);
			Vector2 newValue = offsetPosition.step(deltaTime, current);
			component->setOffsetPosition(entities, newValue);
			//printf("new offset position: %4.2fx%4.2f\n", newValue.x, newValue.y);
			if (offsetPosition.isComplete)
			{
				animatingProperties &= ~OFFSET_POSITION;
			}
		}
		if ((animatingProperties & OFFSET_SIZE) == OFFSET_SIZE)
		{
			const Vector2 current = component->getOffsetSize(entities);
			Vector2 newValue = offsetSize.step(deltaTime, current);
			component->setOffsetSize(entities, newValue);
			if (offsetSize.isComplete)
			{
				animatingProperties &= ~OFFSET_SIZE;
			}
		}
		if ((animatingProperties & ANCHOR_POINT) == ANCHOR_POINT)
		{
			const Vector2 current = component->getAnchorPoint(entities);
			Vector2 newValue = anchorPoint.step(deltaTime, current);
			component->setAnchorPoint(entities, newValue);
			if (anchorPoint.isComplete)
			{
				animatingProperties &= ~ANCHOR_POINT;
			}
		}
		if ((animatingProperties & ALPHA) == ALPHA)
		{
			const float current = ((float)component->getAlpha(entities))/(float)0xFF;
			float newValue = alpha.step(deltaTime, current);
			newValue = newValue > 1.0 ? 1.0 : (newValue < 0.0 ? 0.0 : newValue);
			component->setAlpha(entities, newValue*0xFF);
			if (alpha.isComplete)
			{
				animatingProperties &= ~ALPHA;
			}
		}
		bool wasComplete = isComplete;
		isComplete = animatingProperties == 0;
		if (isComplete && !wasComplete && disableOnComplete)
		{
			component->disable(entities);
		}
	}

private:
	std::shared_ptr<struct Component> component;
	uint16_t animatingProperties = 0;
	SpringState2 relativePosition;
	SpringState2 relativeSize;
	SpringState2 offsetPosition;
	SpringState2 offsetSize;
	SpringState2 anchorPoint;
	SpringState1 alpha;
};

struct SpringAnimation : Movement
{
	enum Type
	{
		RelativePosition,
		OffsetPosition,
		RelativeSize,
		OffsetSize
	};

	std::shared_ptr<struct Component> component;
	Type type;
	Vector2 velocity;
	Vector2 destination;
	float stiffness;
	float damping;
	float precision;

	SpringAnimation(
		std::shared_ptr<struct Component> component,
		SpringAnimation::Type type,
		const Vector2& destination,
		float stiffness,
		float damping,
		float precision)
	: component(component)
	, type(type)
	, velocity(Vector2())
	, destination(destination)
	, stiffness(stiffness)
	, damping(damping)
	, precision(precision) {}

	const Vector2 stepSpring(float deltaTime, const Vector2& current)
	{
		deltaTime /= 1000.0f;
		const Vector2 displacement = current - destination;

		const Vector2 springForce = -stiffness * displacement;
		const Vector2 dampForce = velocity * -damping;

		const Vector2 acceleration = springForce + dampForce;
		const Vector2 newVelocity = velocity + acceleration * deltaTime;
		const Vector2 newPosition = current + velocity * deltaTime;

		if (fabs(newPosition.x-destination.x) < precision
			&& fabs(newPosition.y-destination.y) < precision
			&& fabs(newVelocity.x) < precision
			&& fabs(newVelocity.y) < precision
			&& deltaTime > 0.0f)
		{
			velocity = Vector2();
			isComplete = true;
			return destination;
		}
		else
		{
			velocity = newVelocity;
			return newPosition;
		}
	}

	void onStep(std::vector<Entity>& entities, float deltaTime) override
	{
		switch (type)
		{
			case RelativePosition:
			{
				const Vector2 value = stepSpring(deltaTime, component->getRelativePosition(entities));
				component->setRelativePosition(entities, value);
				break;
			}
			case OffsetPosition:
			{
				const Vector2 value = stepSpring(deltaTime, component->getOffsetPosition(entities));
				component->setOffsetPosition(entities, value);
				break;
			}
			case RelativeSize:
			{
				const Vector2 value = stepSpring(deltaTime, component->getRelativeSize(entities));
				component->setRelativeSize(entities, value);
				break;
			}
			case OffsetSize:
			{
				const Vector2 value = stepSpring(deltaTime, component->getOffsetSize(entities));
				component->setOffsetSize(entities, value);
				break;
			}
		}
	}
};

struct FixedCapacityPool
{
	std::vector<std::shared_ptr<struct Component>> pool;

	FixedCapacityPool(
		std::vector<Entity>& entities,
		uint32_t capacity,
		struct Component* parent,
		std::function<std::shared_ptr<struct Component>()> initialize)
	{
		for (int32_t i = 0; i < capacity; ++i)
		{
			//printf("jhelms spawning %d\n", i);
			auto component = initialize();
			component->disable(entities);
			pool.push_back(component);
			parent->addChild(entities, component);
		}
	}

	std::shared_ptr<struct Component> get(std::vector<Entity>& entities)
	{
		for (auto component : pool)
		{
			if (!component->isEnabled(entities))
			{
				component->enable(entities);
				return component;
			}
		}
		//assert false?
		return nullptr;
	}
};

struct DrawComponent : Component
{
	DrawComponent(std::vector<Entity>& entities)
	: Component(entities)
	{

	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		//printf("Component::doLayout %4.2f x %4.2f, %4.2f x %4.2f\n", screenPosition.x, screenPosition.y, screenSize.x, screenSize.y);
		for (int32_t index = getStartIndex(entities) + 1; index <= getEndIndex(entities); ++index)
		{
			Entity& entity = entities[index];
			switch (entity.type)
			{
				case Type::FillCircle:
				case Type::StrokeCircle:
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
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
		doLayoutChildren(entities);
	}
};

struct RoundedRectangleComponent : DrawComponent
{
	RoundedRectangleComponent(
		std::vector<Entity>& entities,
		float radius,
		float thickness,
		uint32_t strokeRgba,
		uint32_t fillRgba)
	: DrawComponent(entities)
	{
		addEntity(entities, Entity::roundedRectangle(Vector2(), Vector2(), radius, thickness, strokeRgba, fillRgba));
	}

	void setFillColor(std::vector<Entity>& entities, uint32_t rgba)
	{
		entities[getStartIndex(entities)+1].id2 = rgba;
	}

	uint32_t getFillColor(std::vector<Entity>& entities)
	{
		return entities[getStartIndex(entities)+1].id2;
	}

	void setStrokeColor(std::vector<Entity>& entities, uint32_t rgba)
	{
		entities[getStartIndex(entities)+1].id1 = rgba;
	}

	uint32_t getStrokeColor(std::vector<Entity>& entities)
	{
		return entities[getStartIndex(entities)+1].id1;
	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		rectangle.coord1 = screenPosition;
		rectangle.coord3 = screenSize;
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
		doLayoutChildren(entities);
	}
};

struct FilledRectangleComponent : DrawComponent
{
	FilledRectangleComponent(std::vector<Entity>& entities, uint32_t rgba)
	: DrawComponent(entities)
	{
		addEntity(entities, Entity::fillRectangle(Vector2(), Vector2(), rgba));
	}

	void setFillColor(std::vector<Entity>& entities, uint32_t rgba)
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		Entity::setFillColor(rectangle, rgba);
	}

	uint32_t getFillColor(std::vector<Entity>& entities)
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		return Entity::getFillColor(rectangle);
	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		rectangle.coord1 = screenPosition;
		rectangle.coord3 = screenSize;
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
		doLayoutChildren(entities);
	}
};

struct StrokeRectangleComponent : DrawComponent
{
	StrokeRectangleComponent(std::vector<Entity>& entities, float strokeWidth, uint32_t rgba)
	: DrawComponent(entities)
	{
		addEntity(entities, Entity::strokeRectangle(Vector2(), Vector2(), strokeWidth, rgba));
	}

	void setStrokeColor(std::vector<Entity>& entities, uint32_t rgba)
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		Entity::setStrokeColor(rectangle, rgba);
	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		rectangle.coord1 = screenPosition;
		rectangle.coord3 = screenSize;
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		Rect2D rect = doLayoutChildren(entities);
		if (_sizeMode == SizeMode_WidthToContents)
		{
			screenSize.x = rect.maxPoint.x - rect.minPoint.x;
		}
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
	}
};

struct RectangleComponent : DrawComponent
{
	RectangleComponent(std::vector<Entity>& entities, float strokeWidth, uint32_t stroke, uint32_t fill)
	: DrawComponent(entities)
	{
		addEntity(entities, Entity::rectangle(Vector2(), Vector2(), strokeWidth, stroke, fill));
	}

	void setStrokeColor(std::vector<Entity>& entities, uint32_t stroke)
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		Entity::setStrokeColor(rectangle, stroke);
	}

	void setFillColor(std::vector<Entity>& entities, uint32_t rgba)
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		Entity::setFillColor(rectangle, rgba);
	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		rectangle.coord1 = screenPosition;
		rectangle.coord3 = screenSize;
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
		doLayoutChildren(entities);
	}
};

struct FilledCircleComponent : DrawComponent
{
	FilledCircleComponent(std::vector<Entity>& entities, uint32_t rgba)
	: DrawComponent(entities)
	{
		addEntity(entities, Entity::fillCircle(Vector2(), 0.0f, rgba));
	}

	void setRadius(std::vector<Entity>& entities, float offset, float relative)
	{
		setRelativeSize(entities, Vector2(relative*2.0f, relative*2.0f));
		setOffsetSize(entities, Vector2(offset*2.0f, offset*2.0f));
	}

	void setColor(std::vector<Entity>& entities, uint32_t rgba)
	{
		entities[getStartIndex(entities)+1].id1 = rgba;
	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		//printf("FilledCircleComponent cached %4.2f x %4.2f, %4.2f x %4.2f\n",
		//	cachedParentPosition.x, cachedParentPosition.y, cachedParentSize.x, cachedParentSize.y);
		Entity& circle = entities[getStartIndex(entities)+1];
		//circle.coord1 = Vector2(screenPosition.x - anchorPoint.x*radius*2.0f, screenPosition.y - anchorPoint.y*radius*2.0f);
		circle.coord1 = screenPosition;
		circle.coord3 = Vector2(screenSize.x/2.0f, screenSize.y/2.0f);
		//printf("FilledCircleComponent doLayoutEntities %4.2f x %4.2f\n", screenPosition.x, screenPosition.y);
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
		doLayoutChildren(entities);
	}
};
struct StrokeCircleComponent : DrawComponent
{
	StrokeCircleComponent(std::vector<Entity>& entities, float radius, float thickness, uint32_t rgba)
	: DrawComponent(entities)
	{
		addEntity(entities, Entity::strokeCircle(Vector2(), 0.0f, thickness, rgba));
	}

	void setRadius(std::vector<Entity>& entities, float offset, float relative)
	{
		setRelativeSize(entities, Vector2(relative*2.0f, relative*2.0f));
		setOffsetSize(entities, Vector2(offset*2.0f, offset*2.0f));
	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		Entity& circle = entities[getStartIndex(entities)+1];
		//circle.coord1 = Vector2(screenPosition.x - anchorPoint.x*radius*2.0f, screenPosition.y - anchorPoint.y*radius*2.0f);
		circle.coord1 = screenPosition;
		circle.coord3 = Vector2(screenSize.x/2.0f, screenSize.y/2.0f);
		//printf("StrokeCircleComponent doLayoutEntities %4.2f x %4.2f\n", screenPosition.x, screenPosition.y);
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
		doLayoutChildren(entities);
	}
};

struct ImageComponent : DrawComponent
{
	ImageComponent(
		std::vector<Entity>& entities,
		const std::string& filename)
	: DrawComponent(entities)
	{
		Entity imageEntity = Entity::image(filename, Vector2(), Vector2());
		addEntity(entities, imageEntity);
	}

	void setFillColor(std::vector<Entity>& entities, uint32_t rgba)
	{
		Entity::setFillColor(entities[getStartIndex(entities)+1], rgba);
	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		Entity& rectangle = entities[getStartIndex(entities)+1];
		rectangle.coord1 = screenPosition;
		rectangle.coord3 = screenSize;
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
		doLayoutChildren(entities);
	}

	void setImage(std::vector<Entity>& entities, const std::string& filename)
	{
		Entity::setImage(entities[getStartIndex(entities)+1], filename);
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
		//addEntity(entities, Entity::rectangle(Vector2(), Vector2(), 0x00000099));
	}

	void setFillColor(std::vector<Entity>& entities, uint32_t rgba)
	{
		Entity::setFillColor(entities[getStartIndex(entities)+1], rgba);
	}

	void setSizeMode(std::vector<Entity>& entities, SizeMode sizeMode) override
	{
		_sizeMode = sizeMode;
		switch (_sizeMode)
		{
			case SizeMode_Normal:
			case SizeMode_FixedAspectRatio:
			case SizeMode_WidthToContents:
			{
				break;
			}
			case SizeMode_SizeToContents:
			{
				setOffsetSize(entities, entities[getStartIndex(entities)+1].coord3);
				break;
			}
		}
	}

	void setText(std::vector<Entity>& entities, const std::string& text)
	{
		Entity::setText(entities[getStartIndex(entities)+1], text);
		switch (_sizeMode)
		{
			case SizeMode_Normal:
			case SizeMode_FixedAspectRatio:
			case SizeMode_WidthToContents:
			{
				break;
			}
			case SizeMode_SizeToContents:
			{
				setOffsetSize(entities, entities[getStartIndex(entities)+1].coord3);
				relayout(entities);
				break;
			}
		}
	}

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		Entity& textEntity = entities[getStartIndex(entities)+1];

		switch (_sizeMode)
		{
			case SizeMode_Normal:
			case SizeMode_WidthToContents:
			{				
				const std::string& text = Entity::getText(textEntity);
				float fontSize = Entity::getFontSize(textEntity);
				if (fontSize == 0.0f)
				{
					fontSize = 10.0f;
				}
				float width = Engine_MeasureTextWidth(text.c_str(), fontSize);
				if (screenSize.x <= 0.1)
				{
					break;
				}
				float ratio = screenSize.x/width;
				float newFontSize = fontSize*ratio;
				const Vector2& anchorPoint = getAnchorPoint(entities);
				Entity::setFontSize(textEntity, newFontSize);
				Entity::setPosition(
					textEntity,
					Vector2(screenPosition.x, screenPosition.y + (screenSize.y-newFontSize)*anchorPoint.y));
				// printf("text fontSize: %4.2f, %4.2f, %4.2f, %4.2f, %4.2f\n",
				// 	fontSize, screenSize.x, width, ratio, newFontSize);
				//Engine_MeasureTextHeight(text.c_str(), newFontSize);
				//printf("jhelms setting text size: %4.2f, %4.2f, %4.2f, %4.2f, %4.2f\n", screenSize.x, width, ratio, newFontSize, newHeight);

				// Entity& rectEntity = entities[getStartIndex(entities)+2];
				// Entity::setPosition(rectEntity, screenPosition);
				// Entity::setSize(rectEntity, screenSize);
				break;
			}
			case SizeMode_FixedAspectRatio:
			{
				//assert false? TextComponent doesn't support FixedAspectRatio
				break;
			}
			case SizeMode_SizeToContents:
			{
				// float fontSize = Entity::getFontSize(textEntity);
				// printf("fontSize: %4.2f, entitySize: %4.2f, %4.2f\n",
				// 	fontSize, entities[getStartIndex(entities)+1].coord3.x, entities[getStartIndex(entities)+1].coord3.y);
				Entity::setPosition(textEntity, screenPosition);
				setOffsetSize(entities, entities[getStartIndex(entities)+1].coord3);
				break;
			}
		}
	}

	void doLayout(
		std::vector<Entity>& entities,
		const Vector2& parentPosition,
		const Vector2& parentSize) override
	{
		const Vector2 oldScreenSize = screenSize;
		const Vector2 oldScreenPosition = screenPosition;
		doLayoutCommon(entities, parentPosition, parentSize);
		doLayoutEntities(entities, oldScreenPosition, oldScreenSize);
		doLayoutChildren(entities);
	}
};

struct ComponentCell : Component
{
	uint32_t row;
	uint32_t column;
	uint32_t state;
	bool selected;

	std::shared_ptr<struct Component> custom;

	ComponentCell(std::vector<Entity>& entities)
	: row(0)
	, column(0)
	, state(0)
	, selected(false)
	, Component(entities) {}

	~ComponentCell()
	{
		printf("~ComponentCell\n");
	}
};

struct ComponentGrid : Component
{
	struct CellRelationship
	{
		std::shared_ptr<ComponentCell> cell;
		float distance;

		CellRelationship(std::shared_ptr<ComponentCell> cell, float distance)
		: cell(cell), distance(distance) {}
	};
	Vector2Int maxGridSize;
	Vector2Int gridSize;
	std::function<struct Component*()> createBGCell;
	std::function<struct Component*()> createFGCell;
	std::function<void(struct Component*, uint32_t, uint32_t, uint32_t)> setCellState;
	std::shared_ptr<FixedCapacityPool> pool;
	std::vector<std::vector<std::shared_ptr<ComponentCell>>> grid;

	float paddingPercent;
	Vector2 cellRelativeSize;
	Vector2 paddingRelativeSize;
	bool staggered;

	ComponentGrid(
		std::vector<Entity>& entities,
		Vector2Int maxGridSize,
		float paddingPercent,
		std::function<struct Component*()> createBGCell,
		std::function<struct Component*()> createFGCell,
		std::function<void(struct Component*, uint32_t, uint32_t, uint32_t)> setCellState)
	: maxGridSize(maxGridSize)
	, gridSize(maxGridSize)
	, paddingPercent(paddingPercent)
	, paddingRelativeSize(paddingPercent/(gridSize.x + 1), paddingPercent/(gridSize.y + 1))
	, createBGCell(createBGCell)
	, createFGCell(createFGCell)
	, setCellState(setCellState)
	, staggered(false)
	, Component(entities)
	{
		cellRelativeSize = Vector2((1.0 - paddingPercent)/gridSize.x, (1.0 - paddingPercent)/gridSize.y);

		for (int32_t row = 0; row < maxGridSize.y; ++row)
		{
			grid.push_back(std::vector<std::shared_ptr<ComponentCell>>());
			for (int32_t column = 0; column < maxGridSize.x; ++column)
			{
				grid[row].push_back(nullptr);
				if (createBGCell)
				{
					auto cell = std::shared_ptr<struct Component>(createBGCell());
					cell->setRelativeSize(entities, Vector2(cellRelativeSize.x, cellRelativeSize.y));
					cell->setRelativePosition(entities, getPosition(entities, row, column));
					cell->setOffsetPosition(entities, Vector2(1.0, 1.0));
					cell->setOffsetSize(entities, Vector2(-2.0, -2.0));
					addChild(entities, cell);
				}
			}
		}

		pool.reset(new FixedCapacityPool(
			entities,
			maxGridSize.x*maxGridSize.y*2,
			//0,
			this,
			[&entities, createFGCell](){

				auto cell = std::shared_ptr<ComponentCell>(new ComponentCell(entities));
				auto animation = std::shared_ptr<PropertyAnimation>(new PropertyAnimation(cell));
				cell->movement = animation;

				std::shared_ptr<struct Component> child = nullptr;
				child.reset(createFGCell());
				child->setRelativeSize(entities, Vector2(1.0, 1.0));

				cell->custom = child;
				cell->addChild(entities, child);
				return cell;
			}
		));
	}

	CellRelationship getClosestCell(std::vector<Entity>& entities, std::shared_ptr<ComponentCell> cell)
	{	
		uint32_t inRow = cell->row;
		uint32_t inColumn = cell->column;
		uint32_t closestRow = inRow;
		uint32_t closestColumn = inColumn;
		float minDistance = 1000000;
		std::shared_ptr<ComponentCell> best = nullptr;
		for (int32_t row = 0; row < gridSize.y; ++row)
		{
			for (int32_t column = 0; column < gridSize.x; ++column)
			{
				auto other = grid[row][column];
				float distance = 1000000;
				if (row == inRow && column == inColumn)
				{
					Vector2 originalPosition = impliedPosition(
						screenPosition,
						screenSize,
						Vector2(cellRelativeSize.x, cellRelativeSize.y),
						Vector2(),
						getPosition(entities, row, column),
						Vector2(),
						cell->getAnchorPoint(entities));
					distance = Vector2::distance(cell->screenPosition, originalPosition);
				}
				else
				{
					distance = Vector2::distance(cell->screenPosition, other->screenPosition);
				}
				if (distance < minDistance && other->isDraggable)
				{
					minDistance = distance;
					best = other;
					closestRow = row;
					closestColumn = column;
				}
			}
		}

		return CellRelationship(best, minDistance);
	}

	void moveToClosestCellAndShift(std::vector<Entity>& entities, std::shared_ptr<ComponentCell> cell)
	{
		//assert gridSize.x == 1
		CellRelationship closest = getClosestCell(entities, cell);

		if (closest.distance >= 1.5f*cell->screenSize.x/2.0
			|| closest.cell == nullptr
			|| closest.cell->row == cell->row)
		{
			moveSwap(entities, cell->row, cell->column, cell->row, cell->column);
			return;
		}

		uint32_t targetRow = closest.cell->row;
		uint32_t targetColumn = closest.cell->column;

		if (targetRow < cell->row)
		{
			for (int32_t row = cell->row - 1; row >= (int32_t)targetRow; --row)
			{
				printf("moving %d", row);
				moveSwap(entities, row, 0, row + 1, 0);
			}
			moveSwap(entities, cell->row, cell->column, targetRow, targetColumn);
		}
		else
		{
			for (int32_t row = cell->row + 1; row <= (int32_t)targetRow; ++row)
			{
				printf("moving %d", row);
				moveSwap(entities, row, 0, row - 1, 0);
			}
			moveSwap(entities, cell->row, cell->column, targetRow, targetColumn);
		}
	}

	void swapWithClosestCell(std::vector<Entity>& entities, std::shared_ptr<ComponentCell> cell)
	{
		CellRelationship closest = getClosestCell(entities, cell);

		if (closest.distance < 1.5f*cell->screenSize.x/2.0)
		{
			moveSwap(entities, cell->row, cell->column, closest.cell->row, closest.cell->column);
		}
		else
		{
			moveSwap(entities, cell->row, cell->column, cell->row, cell->column);
		}
	}

	bool areAdjacent(
		uint32_t row1, uint32_t column1,
		uint32_t row2, uint32_t column2)
	{
		if (row2 == row1
			&& (column2 == column1-1
			    || column2 == column1+1))
		{
			return true;
		}

		if (column2 == column1
			&& (row2 == row1-1
				|| row2 == row1+1))
		{
			return true;
		}

		if ((!staggered || (row1%2 == 1))
			&& column2 == column1+1
			&& (row2 == row1-1
				|| row2 == row1+1))
		{
			return true;
		}

		if ((!staggered || (row1%2 == 0))
			&& column2 == column1-1
			&& (row2 == row1-1
				|| row2 == row1+1))
		{
			return true;
		}

		return false;
	}

	void clear(std::vector<Entity>& entities)
	{
		for (int32_t row = 0; row < maxGridSize.y; ++row)
		{
			for (int32_t column = 0; column < maxGridSize.x; ++column)
			{
				auto cell = grid[row][column];
				if (cell)
				{
					cell->disable(entities);
					grid[row][column] = nullptr;
				}
			}
		}
	}

	void remove(std::vector<Entity>& entities, std::shared_ptr<ComponentCell> cell)
	{
		cell->disable(entities);
		grid[cell->row][cell->column] = nullptr;
	}

	void resizeGrid(std::vector<Entity>& entities, const Vector2Int& newGridSize)
	{
		//assert newGridSize < maxGridSize
		clear(entities);
		gridSize = newGridSize;
		cellRelativeSize = Vector2((1.0 - paddingPercent)/gridSize.x, (1.0 - paddingPercent)/gridSize.y);
		paddingRelativeSize = Vector2(paddingPercent/(gridSize.x + 1), paddingPercent/(gridSize.y + 1));
	}

	void isValidCoordinate(uint32_t row, uint32_t column)
	{
		if (row >= gridSize.y || column >= gridSize.x)
		{
			printf("invalid coordinate %ux%u\n", row, column);
		}
	}

	Vector2 getPosition(
		std::vector<Entity>& entities,
		int32_t row,
		int32_t column)
	{
		return Vector2(
			column*cellRelativeSize.x + paddingRelativeSize.x*(column+1),
			row*cellRelativeSize.y + paddingRelativeSize.y*(row+1));
	}

	void layoutCell(
		std::vector<Entity>& entities,
		std::shared_ptr<struct Component> cell,
		uint32_t row,
		uint32_t column)
	{
		cell->setRelativeSize(entities, Vector2(cellRelativeSize.x, cellRelativeSize.y));
		cell->setRelativePosition(entities, getPosition(entities, row, column));
		cell->setOffsetPosition(entities, Vector2());
	}

	std::shared_ptr<ComponentCell> spawn(
		std::vector<Entity>& entities,
		uint32_t row,
		uint32_t column,
		uint32_t state)
	{
		isValidCoordinate(row, column);
		auto cell = std::dynamic_pointer_cast<ComponentCell>(pool->get(entities));
		//assert cell is not nullptr
		cell->row = row;
		cell->column = column;
		cell->state = state;
		layoutCell(entities, cell, row, column);
		grid[row][column] = cell;
		if (setCellState)
		{
			setCellState(cell->custom.get(), row, column, state);
		}
		//printf("jhelms spawn %p %ux%u == %ux%u\n", cell.get(), row, column, cell->row, cell->column);
		return cell;
	}

	void setState(std::shared_ptr<ComponentCell> cell, uint32_t state)
	{
		cell->state = state;
		setCellState(cell->custom.get(), cell->row, cell->column, state);
	}

	void fallLeft(std::vector<Entity>& entities)
	{
		for (int32_t row = 0; row < gridSize.y; ++row)
		{
			int32_t firstEmpty = -1;
			for (int32_t column = 0; column < gridSize.x; ++column)
			{
				auto cell = grid[row][column];
				if (cell)
				{
					if (firstEmpty > -1)
					{
						move(entities, row, column, row, firstEmpty);
						firstEmpty = firstEmpty + 1;
					}
				}
				else if (firstEmpty == -1)
				{
					firstEmpty = column;
				}
			}
		}
	}

	void fallUp(std::vector<Entity>& entities)
	{
		for (int32_t column = 0; column < gridSize.x; ++column)
		{
			int32_t firstEmpty = -1;
			for (int32_t row = 0; row < gridSize.y; ++row)
			{
				auto cell = grid[row][column];
				if (cell)
				{
					if (firstEmpty > -1)
					{
						move(entities, row, column, firstEmpty, column);
						firstEmpty = firstEmpty + 1;
					}
				}
				else if (firstEmpty == -1)
				{
					firstEmpty = row;
				}
			}
		}
	}

	void fallRight(std::vector<Entity>& entities)
	{
		for (int32_t row = 0; row < gridSize.y; ++row)
		{
			int32_t firstEmpty = -1;
			for (int32_t column = gridSize.x-1; column >= 0; --column)
			{
				auto cell = grid[row][column];
				if (cell)
				{
					if (firstEmpty > -1)
					{
						move(entities, row, column, row, firstEmpty);
						firstEmpty = firstEmpty - 1;
					}
				}
				else if (firstEmpty == -1)
				{
					firstEmpty = column;
				}
			}
		}
	}

	void fallDown(std::vector<Entity>& entities)
	{
		for (int32_t column = 0; column < gridSize.x; ++column)
		{
			int32_t firstEmpty = -1;
			for (int32_t row = gridSize.y-1; row >= 0 ; --row)
			{
				auto cell = grid[row][column];
				if (cell)
				{
					if (firstEmpty > -1)
					{
						move(entities, row, column, firstEmpty, column);
						firstEmpty = firstEmpty - 1;
					}
				}
				else if (firstEmpty == -1)
				{
					firstEmpty = row;
				}
			}
		}
	}

	void move(
		std::vector<Entity>& entities,
		uint32_t row1,
		uint32_t column1,
		uint32_t row2,
		uint32_t column2)
	{
		isValidCoordinate(row1, column1);
		isValidCoordinate(row2, column2);
		auto cell = grid[row1][column1];
		//assert cell != nullptr
		cell->row = row2;
		cell->column = column2;
		grid[row2][column2] = cell;
		grid[row1][column1] = nullptr;

		auto animation = std::dynamic_pointer_cast<PropertyAnimation>(cell->movement);
		//printf("animation? %p %p\n", animation.get(), cell->movement.get());
		animation->setRelativePosition(getPosition(entities, row2, column2));
		//cell->setRelativePosition(entities, getPosition(entities, row2, column2));
	}

	void validateConsistency()
	{
		for (int32_t row = 0; row < gridSize.y; ++row)
		{
			for (int32_t column = 0; column < gridSize.x; ++column)
			{
				auto cell = grid[row][column];
				if (cell->row != row || cell->column != column)
				{
					printf("Error! inconsistent cell: %ux%u is %ux%u\n", row, column, cell->row, cell->column);
				}
			}
		}
	}

	void swap(
		std::vector<Entity>& entities,
		const int32_t row1,
		const uint32_t column1,
		const uint32_t row2,
		const uint32_t column2)
	{
		auto cell1 = grid[row1][column1];
		auto cell2 = grid[row2][column2];

		cell1->row = row2;
		cell1->column = column2;
		cell2->row = row1;
		cell2->column = column1;
		grid[row1][column1] = cell2;
		grid[row2][column2] = cell1;

		cell1->setRelativePosition(entities, getPosition(entities, row2, column2));
		cell2->setRelativePosition(entities, getPosition(entities, row1, column1));
	}

	void moveSwap(
		std::vector<Entity>& entities,
		const int32_t row1,
		const uint32_t column1,
		const uint32_t row2,
		const uint32_t column2)
	{
		isValidCoordinate(row1, column1);
		isValidCoordinate(row2, column2);
		auto cell1 = grid[row1][column1];
		auto cell2 = grid[row2][column2];

		cell1->row = row2;
		cell1->column = column2;
		cell2->row = row1;
		cell2->column = column1;
		grid[row1][column1] = cell2;
		grid[row2][column2] = cell1;

		printf("jhelms moveSwap (%p) %ux%u -> (%p) %ux%u\n", cell1.get(), row1, column1, cell2.get(), row2, column2);

		auto animation1 = std::shared_ptr<SpringAnimation>(new SpringAnimation(
			cell1,
			SpringAnimation::RelativePosition,
			getPosition(entities, row2, column2),
			1000.0f,
			100.0f,
			0.001f
		));
		cell1->movement = animation1;
		
		auto animation2 = std::shared_ptr<SpringAnimation>(new SpringAnimation(
			cell2,
			SpringAnimation::RelativePosition,
			getPosition(entities, row1, column1),
			1000.0f,
			100.0f,
			0.001f
		));
		cell2->movement = animation2;
	}

	void swapToTop(
		std::vector<Entity>& entities,
		std::shared_ptr<ComponentCell> cell)
	{
		// printf("swapToTop 1\n");
		// validateConsistency();
		
		uint32_t inRow = cell->row;
		uint32_t inColumn = cell->column;
		//assert cell
		auto highestCell = cell;
		uint32_t highestStartIndex = cell->getStartIndex(entities);

		for (int32_t row = 0; row < gridSize.y; ++row)
		{
			for (int32_t column = 0; column < gridSize.x; ++column)
			{
				auto otherCell = grid[row][column];
				if (!otherCell || otherCell->selected)
				{
					continue;
				}
				uint32_t startIndex = otherCell->getStartIndex(entities);
				if (startIndex > highestStartIndex)
				{
					highestStartIndex = startIndex;
					highestCell = otherCell;
				}
			}
		}

		printf("swapToTop 2 %ux%u\n", highestCell->row, highestCell->column);
		// validateConsistency();
		swapComponentEntities(entities, cell.get(), highestCell.get());

		// printf("swapToTop 3\n");
		// validateConsistency();
	}
};

struct EntityGrid : DrawComponent
{
	static const uint32_t EMPTY = 0;

	Vector2Int matrixSize;
	std::function<void(std::vector<Entity>&, uint32_t, uint32_t)> onCellStateChange;

	EntityGrid(
		std::vector<Entity>& entities,
		Vector2Int matrixSize,
		std::function<Entity()> initializeCell,
		std::function<void(std::vector<Entity>&, uint32_t, uint32_t)> onCellStateChange)
	: DrawComponent(entities)
	, matrixSize(matrixSize)
	, onCellStateChange(onCellStateChange)
	{
		float cellSpacing = 10.0f;
		float padding = 2.0f;
		for (int32_t i = 0; i < matrixSize.x; ++i)
		{
			for(int32_t j = 0; j < matrixSize.y; ++j)
			{
				Vector2 position(i*cellSpacing + padding/2.0, j*cellSpacing + padding/2.0);
				Vector2 size(cellSpacing - padding, cellSpacing - padding);
				Entity entity = initializeCell();
				Entity::setPosition(entity, position);
				Entity::setSize(entity, size);
				entities.push_back(entity);
			}
		}
		setEndIndex(entities, entities.size() - 1);
		screenSize = Vector2(matrixSize.x*cellSpacing, matrixSize.y*cellSpacing);
		aspectRatio = (float)matrixSize.x/(float)matrixSize.y;
	}

	BoxInt getBoundingSquare(std::vector<Entity>& entities, uint32_t state, uint32_t mask)
	{
		int32_t minX = matrixSize.x;
		int32_t maxX = -1;
		int32_t minY = matrixSize.y;
		int32_t maxY = -1;

		for (int32_t i = 0; i < matrixSize.x; ++i)
		{
			for(int32_t j = 0; j < matrixSize.y; ++j)
			{
				if ((getCell(entities, j, i)&mask) == state)
				{
					minX = i < minX ? i : minX;
					maxX = i > maxX ? i : maxX;
					minY = j < minY ? j : minY;
					maxY = j > maxY ? j : maxY;
				}
			}
		}

		int32_t width = maxX - minX;
		int32_t height = maxY - minY;
		if (width < height)
		{
			int32_t delta = height - width;
			int32_t offByOne = delta % 2;
			bool onRightSide = minX + width/2 > matrixSize.x/2;
			minX -= delta/2 + (onRightSide ? offByOne : 0);
			maxX += delta/2 + (onRightSide ? 0 : offByOne);
			width = maxX - minX;
			if (maxX >= matrixSize.x)
			{
				int32_t temp = maxX - matrixSize.x + 1;
				maxX -= temp;
				minX -= temp;
			}
			if (minX < 0)
			{
				int32_t temp = -minX;
				maxX += temp;
				minX += temp;
			}
		}
		else if (height < width)
		{
			maxY += (width - height);
			height = maxY - minY;
			if (maxY >= matrixSize.y)
			{
				int32_t temp = maxY - matrixSize.y + 1;
				maxY -= temp;
				minY -= temp;
			}
		}
		return BoxInt(Vector2Int(minX, minY), Vector2Int(width+1, height+1));
	}

	bool canMoveUp(std::vector<Entity>& entities, uint32_t activeState, uint32_t mask)
	{
		for (int32_t row = 0; row < matrixSize.y; ++row)
		{
			for(int32_t column = 0; column < matrixSize.x; ++column)
			{
				uint32_t newMasked = row > 0 ? getCell(entities, row+1, column)&mask : EMPTY;
				uint32_t currentMasked = getCell(entities, row, column)&mask;
				if ((newMasked == activeState && currentMasked != activeState && currentMasked != EMPTY)
					|| (row == matrixSize.y-1 && currentMasked == activeState))
				{
					return false;
				}
			}
		}
		return true;
	}

	bool canMoveDown(std::vector<Entity>& entities, uint32_t activeState, uint32_t mask)
	{
		for (int32_t row = matrixSize.y-1; row >= 0; --row)
		{
			for(int32_t column = 0; column < matrixSize.x; ++column)
			{
				uint32_t newMasked = row > 0 ? getCell(entities, row-1, column)&mask : EMPTY;
				uint32_t currentMasked = getCell(entities, row, column)&mask;
				if ((newMasked == activeState && currentMasked != activeState && currentMasked != EMPTY)
					|| (row == matrixSize.y-1 && currentMasked == activeState))
				{
					return false;
				}
			}
		}
		return true;
	}

	bool canMoveLeft(std::vector<Entity>& entities, uint32_t activeState, uint32_t mask)
	{
		for(int32_t column = 0; column < matrixSize.x; ++column)
		{
			for (int32_t row = matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentMasked = getCell(entities, row, column)&mask;
				uint32_t newMasked = column < matrixSize.x-1 ? getCell(entities, row, column+1)&mask : EMPTY;
				if ((newMasked == activeState && currentMasked != activeState && currentMasked != EMPTY)
					|| (column == 0 && currentMasked == activeState))
				{
					return false;
				}
			}
		}
		return true;
	}

	bool canMoveRight(std::vector<Entity>& entities, uint32_t activeState, uint32_t mask)
	{
		for(int32_t column = matrixSize.x-1; column >= 0 ; --column)
		{
			for (int32_t row = matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentMasked = getCell(entities, row, column)&mask;
				uint32_t newMasked = column > 0 ? getCell(entities, row, column-1)&mask : EMPTY;
				if ((newMasked == activeState && currentMasked != activeState && currentMasked != EMPTY)
					|| (column == matrixSize.x-1 && currentMasked == activeState))
				{
					return false;
				}
			}
		}
		return true;
	}

	bool canSwap(
		std::vector<Entity>& entities,
		const Vector2Int& a,
		const Vector2Int& b,
		uint32_t activeState,
		uint32_t mask)
	{
		bool aInBounds = isValidCoordinate(a);
		bool bInBounds = isValidCoordinate(b);
		if (!aInBounds && !bInBounds)
		{
			return true;
		}
		if (aInBounds && !bInBounds)
		{
			uint32_t maskedA = getCell(entities, a.y, a.x)&mask;
			return maskedA == EMPTY;
		}
		if (bInBounds && !aInBounds)
		{
			uint32_t maskedB = getCell(entities, b.y, b.x)&mask;
			return maskedB == EMPTY;
		}
		uint32_t maskedA = getCell(entities, a.y, a.x)&mask;
		uint32_t maskedB = getCell(entities, b.y, b.x)&mask;
		return !((maskedA == activeState && (maskedB != activeState && maskedB != EMPTY))
				|| (maskedB == activeState && (maskedA != activeState && maskedA != EMPTY)));
	}

	bool canRotate(
		std::vector<Entity>& entities,
		const Vector2Int& offset,
		const uint32_t shapeWidth,
		const uint32_t activeState,
		const uint32_t mask)
	{
		if (offset.x < 0
			|| offset.x + shapeWidth > matrixSize.x
			|| offset.y < 0
			|| offset.y + shapeWidth > matrixSize.y)
		{
			printf("Can't rotate: %d %d %d %d\n", offset.x, offset.y, offset.x + shapeWidth, offset.y + shapeWidth);
			return false;
		}
		for(int32_t x = 0; x < shapeWidth; ++x)
		{
			for (int32_t y = x; y < shapeWidth-x-1; ++y)
			{
				Vector2Int coord1(offset.x + x, offset.y + y);
				Vector2Int coord2(offset.x + y, offset.y + shapeWidth - 1 - x);
				Vector2Int coord3(offset.x + shapeWidth - 1 - x, offset.y + shapeWidth - 1);
				Vector2Int coord4(offset.x + shapeWidth - 1 - y, offset.y + x);

				bool isFree = canSwap(entities, coord1, coord2, activeState, mask)
					&& canSwap(entities, coord2, coord3, activeState, mask)
					&& canSwap(entities, coord3, coord4, activeState, mask)
					&& canSwap(entities, coord4, coord1, activeState, mask);
				if (!isFree)
				{
					return false;
				}
			}
		}
		return true;
	}

	void setCellAux(
		std::vector<Entity>& entities,
		const Vector2Int coord,
		const int64_t newState,
		const uint32_t activeState,
		const uint32_t mask)
	{
		if (newState < 0)
		{
			return;
		}
		if (!isValidCoordinate(coord))
		{
			return;
		}
		uint32_t newMasked = newState&mask;
		uint32_t state = getCell(entities, coord.y, coord.x);
		uint32_t masked = state&mask;
		if ((masked != activeState && masked != EMPTY) || (newMasked != activeState && newMasked != EMPTY))
		{
			return;
		}
		setCell(entities, coord.y, coord.x, newState);
	}

	void rotate(
		std::vector<Entity>& entities,
		const Vector2Int& offset,
		const uint32_t shapeWidth,
		const uint32_t activeState,
		const uint32_t mask)
	{
		for(int32_t x = 0; x < shapeWidth/2; ++x)
		{
			for (int32_t y = x; y < shapeWidth-x-1; ++y)
			{
				Vector2Int coord1(offset.x + x, offset.y + y);
				Vector2Int coord2(offset.x + y, offset.y + shapeWidth - 1 - x);
				Vector2Int coord3(offset.x + shapeWidth - 1 - x, offset.y + shapeWidth - 1 - y);
				Vector2Int coord4(offset.x + shapeWidth - 1 - y, offset.y + x);

				int64_t state1 = isValidCoordinate(coord1) ?  getCell(entities, coord1.y, coord1.x) : EMPTY;
				int64_t state2 = isValidCoordinate(coord2) ?  getCell(entities, coord2.y, coord2.x) : EMPTY;
				int64_t state3 = isValidCoordinate(coord3) ?  getCell(entities, coord3.y, coord3.x) : EMPTY;
				int64_t state4 = isValidCoordinate(coord4) ?  getCell(entities, coord4.y, coord4.x) : EMPTY;

				setCellAux(entities, coord1, state2, activeState, mask);
				setCellAux(entities, coord2, state3, activeState, mask);
				setCellAux(entities, coord3, state4, activeState, mask);
				setCellAux(entities, coord4, state1, activeState, mask);
			}
		}
	}

	void moveUp(std::vector<Entity>& entities, uint32_t activeState, const BoxInt& box)
	{
		for (int32_t row = box.position.y; row < box.position.y + box.size.y; ++row)
		{
			for(int32_t column = box.position.x; column < box.position.x + box.size.x; ++column)
			{
				uint32_t currentState = getCell(entities, row, column);
				uint32_t newState = row > 0 ? getCell(entities, row+1, column) : EMPTY;
				uint32_t currentMasked = currentState&0xFF;
				uint32_t newMasked = newState&0xFF;
				if (currentMasked == activeState && newMasked != activeState)
				{
					newState = EMPTY;
					newMasked = EMPTY;
				}
				if ((currentMasked == activeState && newMasked == EMPTY)
					|| (currentMasked == EMPTY && newMasked == activeState)
					|| (currentMasked == activeState && newMasked == activeState))
				{
					setCell(entities, row, column, newState);
				}
			}
		}
	}

	void moveDown(std::vector<Entity>& entities, uint32_t activeState, const BoxInt& box)
	{
		for (int32_t row = box.position.y + box.size.y - 1; row >= box.position.y; --row)
		{
			for(int32_t column = box.position.x; column < box.position.x + box.size.x; ++column)
			{
				uint32_t currentState = getCell(entities, row, column);
				uint32_t newState = row > 0 ? getCell(entities, row-1, column) : EMPTY;
				uint32_t currentMasked = currentState&0xFF;
				uint32_t newMasked = newState&0xFF;
				if (currentMasked == activeState && newMasked != activeState)
				{
					newState = EMPTY;
					newMasked = EMPTY;
				}
				if ((currentMasked == activeState && newMasked == EMPTY)
					|| (currentMasked == EMPTY && newMasked == activeState)
					|| (currentMasked == activeState && newMasked == activeState))
				{
					setCell(entities, row, column, newState);
				}
			}
		}
	}

	void moveLeft(std::vector<Entity>& entities, uint32_t activeState, const BoxInt& box)
	{
		for(int32_t column = 0; column < matrixSize.x; ++column)
		{
			for (int32_t row = matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = getCell(entities, row, column);
				uint32_t newState = column < matrixSize.x-1 ? getCell(entities, row, column+1) : EMPTY;
				uint32_t currentMasked = currentState&0xFF;
				uint32_t newMasked = newState&0xFF;
				if (currentMasked == activeState && newMasked != activeState && newMasked != EMPTY)
				{
					newState = EMPTY;
					newMasked = EMPTY;
				}
				if ((currentMasked == activeState && newMasked == EMPTY)
					|| (currentMasked == EMPTY && newMasked == activeState)
					|| (currentMasked == activeState && newMasked == activeState))
				{
					setCell(entities, row, column, newState);
				}
			}
		}
	}

	void moveRight(std::vector<Entity>& entities, uint32_t activeState, const BoxInt& box)
	{
		for(int32_t column = matrixSize.x-1; column >= 0 ; --column)
		{
			for (int32_t row = matrixSize.y-1; row >= 0; --row)
			{
				uint32_t currentState = getCell(entities, row, column);
				uint32_t newState = column > 0 ? getCell(entities, row, column-1) : EMPTY;
				uint32_t currentMasked = currentState&0xFF;
				uint32_t newMasked = newState&0xFF;
				if (currentMasked == activeState && newMasked != activeState && newMasked != EMPTY)
				{
					newState = EMPTY;
					newMasked = EMPTY;
				}
				if ((currentMasked == activeState && newMasked == EMPTY)
					|| (currentMasked == EMPTY && newMasked == activeState)
					|| (currentMasked == activeState && newMasked == activeState))
				{
					setCell(entities, row, column, newState);
				}
			}
		}
	}

	uint32_t getCellIndex(std::vector<Entity>& entities, uint32_t row, uint32_t column)
	{
		uint32_t index = getStartIndex(entities) + matrixSize.y*column + row + 1;
		return index;
	}

	uint32_t getCell(std::vector<Entity>& entities, uint32_t row, uint32_t column)
	{
		if (row < 0 || column < 0 || row >= matrixSize.y || column >= matrixSize.x)
		{
			printf("invalid coordinate! %u x %u\n", row, column);
		}
		return (entities[getCellIndex(entities, row, column)].id3);
	}

	void setCell(std::vector<Entity>& entities, uint32_t row, uint32_t column, uint32_t state)
	{
		uint32_t index = getCellIndex(entities, row, column);
		entities[index].id3 = state;
		onCellStateChange(entities, index, state);
	}

	void stamp(
		std::vector<Entity>& entities,
		std::vector<std::vector<uint32_t>> shape,
		Vector2Int offset)
	{
		for (int32_t row = 0; row < shape.size(); ++row)
		{

			for (int32_t column = 0; column < shape[row].size(); ++column)
			{
				printf("jhelms %08x\n", shape[row][column]);
				setCell(entities, row+offset.y, column+offset.x, shape[row][column]);
			}
		}
	}

	bool isValidCoordinate(const Vector2Int& a)
	{
		return a.x >= 0 && a.y >= 0 && a.x < matrixSize.x && a.y < matrixSize.y;
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

	void doStep(float timeDelta, const std::vector<bool>& keyStates)
	{
		loop(timeDelta, keyStates);
		if (rootComponent)
		{
			rootComponent->doStep(entities, timeDelta);
		}
	}

	virtual void loop(float timeDelta, const std::vector<bool>& keyStates) {};

	void onMouseMove(const Vector2& position, const Vector2& delta)
	{
		if (rootComponent)
		{
			rootComponent->onMouseMove(entities, position, delta);
		}
	}

	void onMouseButton1Down(const Vector2& position)
	{
		if (rootComponent)
		{
			rootComponent->onMouseButton1Down(entities, position);
		}
	}

	void onMouseButton1Up(const Vector2& position)
	{
		if (rootComponent)
		{
			rootComponent->onMouseButton1Up(entities, position);
		}
	}

	virtual void onKeyUp(SDL_Keycode key) { }

	virtual void onKeyDown(SDL_Keycode key) { }
};

struct Game
{
	std::vector<bool> keyStates;

	Game()
	: count(0)
	, lastTime(emscripten_get_now())
	, keyStates(std::vector<bool>(4096, false))
	{
		Engine_Init();
		SDL_Init(SDL_INIT_VIDEO);
		SDL_SetVideoMode(50.0f, 50.0f, 32, SDL_SWSURFACE);
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
				case Type::Component:
				{
					if (entity.id3 == 0)
					{
						i = entity.id2;
					}
					break;
				}
				case Type::FillCircle:
				{
					Engine_FilledEllipse(
						entity.coord1.x + entity.coord3.x,
						entity.coord1.y + entity.coord3.y,
						entity.coord3.x,
						entity.coord3.y,
						entity.id1);
					break;
				}
				case Type::StrokeCircle:
				{
					Engine_StrokeEllipse(
						entity.coord1.x + entity.coord3.x,
						entity.coord1.y + entity.coord3.y,
						entity.coord3.x,
						entity.coord3.y,
						entity.coord4.x,
						entity.id1);
					break;
				}
				case Type::Rectangle:
				{
					Engine_Rectangle(
						std::floorf(entity.coord1.x) + 0.0f,
						std::floorf(entity.coord1.y) + 0.0f,
						std::ceilf(entity.coord3.x) + 0.0f,
						std::ceilf(entity.coord3.y) + 0.0f,
						entity.coord4.x,
						entity.id1,
						entity.id2);
					break;
				}
				case Type::FillRectangle:
				{
					Engine_FilledRectangle(
						std::floorf(entity.coord1.x) + 0.0f,
						std::floorf(entity.coord1.y) + 0.0f,
						std::ceilf(entity.coord3.x) + 0.0f,
						std::ceilf(entity.coord3.y) + 0.0f,
						entity.id2);
					break;
				}
				case Type::StrokeRectangle:
				{
					Engine_StrokeRectangle(
						std::floorf(entity.coord1.x) + 0.0f,
						std::floorf(entity.coord1.y) + 0.0f,
						std::ceilf(entity.coord3.x) + 0.0f,
						std::ceilf(entity.coord3.y) + 0.0f,
						entity.coord4.x,
						entity.id2);
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
					break;
				}
				case Type::Image:
				{
					const std::string& filename = Entity::getTextForId(entity.id2);
					Engine_Image(
						filename.c_str(),
						entity.coord1.x,
						entity.coord1.y,
						entity.coord3.x,
						entity.coord3.y,
						entity.id1);
					break;
				}
				default:
				{
					break;
				}
			}
		}
	}

	void onKeyUp(SDL_Keycode key)
	{
		keyStates[key] = false;
		screen->onKeyUp(key);
	}

	void onKeyDown(SDL_Keycode key)
	{
		keyStates[key] = true;
		screen->onKeyDown(key);
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
					onKeyUp(e.key.keysym.sym);
					break;
				}
				case SDL_KEYDOWN:
				{
					onKeyDown(e.key.keysym.sym);
					break;
				}
				case SDL_MOUSEMOTION:
				{
					SDL_MouseMotionEvent *m = (SDL_MouseMotionEvent*)&e;
					screen->onMouseMove(Vector2(m->x, m->y), Vector2(m->xrel, m->yrel));
					break;
				}
				case SDL_MOUSEBUTTONDOWN:
				{
					SDL_MouseButtonEvent *m = (SDL_MouseButtonEvent*)&e;
					printf("button down: %d,%d  %d,%d\n", m->button, m->state, m->x, m->y);
					screen->onMouseButton1Down(Vector2(m->x, m->y));
					break;
				}
				case SDL_MOUSEBUTTONUP:
				{
					SDL_MouseButtonEvent *m = (SDL_MouseButtonEvent*)&e;
					//printf("button up: %d,%d  %d,%d\n", m->button, m->state, m->x, m->y);
					screen->onMouseButton1Up(Vector2(m->x, m->y));
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
		screen->doStep(currentTime-lastTime, keyStates);
		draw(currentTime, count);
		
		lastTime = currentTime;
	}
};




