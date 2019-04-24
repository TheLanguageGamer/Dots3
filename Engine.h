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
	FillCircle,
	StrokeCircle,
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
	virtual void onStep(std::vector<Entity>& entity, float timeDelta) {}
};

struct Component
{
	enum SizeMode
	{
		SizeMode_Normal,
		SizeMode_FixedAspectRatio,
	};
	int32_t _startIndex;
	// int32_t endIndex;
	Vector2 anchorPoint;
	Vector2 screenPosition;
	Vector2 screenSize;
	Vector2 cachedParentSize;
	Vector2 cachedParentPosition;
	float aspectRatio;
	SizeMode sizeMode;

	bool isDraggable;
	bool isDragging;
	std::function<void(Vector2& offsetPosition)> clampOffset;

	bool isClickable;
	bool isSelected;
	std::function<void()> onSelect;
	std::function<void()> onDeselect;
	std::function<void(const Vector2&)> onClick;

	std::shared_ptr<Movement> movement;

	std::vector<std::shared_ptr<Component>> children;
	Component(std::vector<Entity>& entities)
	: _startIndex(entities.size())
	// , endIndex(entities.size())
	, aspectRatio(0.0f)
	, sizeMode(SizeMode_Normal)
	, isDraggable(false)
	, isDragging(false)
	, isClickable(false)
	, isSelected(false)
	{
		_startIndex = entities.size();
		entities.push_back(Entity::component(_startIndex));
		setEndIndex(entities, entities.size()-1);
		//printf("Component initialized3: %d -> %d\n", getStartIndex(entities), getEndIndex(entities));
	}

	uint32_t getStartIndex(std::vector<Entity>& entities)
	{
		return entities[_startIndex].id1;
	}

	uint32_t getEndIndex(std::vector<Entity>& entities)
	{
		return entities[_startIndex].id2;
	}

	void setEndIndex(std::vector<Entity>& entities, uint32_t endIndex)
	{
		entities[_startIndex].id2 = endIndex;
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

	void relayout(std::vector<Entity>& entities)
	{
		doLayout(entities, cachedParentPosition, cachedParentSize);
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

		screenPosition = Vector2(newX, newY);

		applySizeMode();
	}

	void doLayoutChildren(std::vector<Entity>& entities)
	{
		for (auto child : children)
		{
			child->doLayout(entities, screenPosition, screenSize);
		}
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
		
		if (movement)
		{
			movement->onStep(entities, timeDelta);
			relayout(entities);
		}

		for (auto child : children)
		{
			child->doStep(entities, timeDelta);
		}
	}

	void enableDragging(std::function<void(Vector2& offsetPosition)> inClampOffset)
	{
		clampOffset = inClampOffset;
		isDraggable = true;
	}

	void onDrag(std::vector<Entity>& entities, const Vector2& delta)
	{
		const Vector2& offsetPosition = getOffsetPosition(entities);
		Vector2 newOffsetPosition = Vector2(offsetPosition.x + delta.x, offsetPosition.y + delta.y);
		if (clampOffset)
		{
			clampOffset(newOffsetPosition);
		}
		const Vector2 impliedDelta(newOffsetPosition.x - offsetPosition.x, newOffsetPosition.y - offsetPosition.y);
		setOffsetPosition(entities, newOffsetPosition);
		const Vector2 oldScreenPosition = screenPosition;
		screenPosition = Vector2(screenPosition.x + impliedDelta.x, screenPosition.y + impliedDelta.y);
		doLayoutEntities(entities, oldScreenPosition, screenSize);
		doLayoutChildren(entities);
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

	bool onMouseMove(std::vector<Entity>& entities, const Vector2& position, const Vector2& delta)
	{
		if (!isEnabled(entities))
		{
			return false;
		}
		if (isDragging)
		{
			onDrag(entities, delta);
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

		if (isClickable && doesPointIntersectRect(position, screenPosition, screenSize))
		{
			isSelected = true;
			if (onSelect)
			{
				onSelect();
			}
			return true;
		}

		if (isDraggable && doesPointIntersectRect(position, screenPosition, screenSize))
		{
			printf("made draggable\n");
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
			isDragging = false;
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

		if (fabs(newPosition.x-current.x) < precision
			&& fabs(newPosition.y-current.y) < precision
			&& fabs(newVelocity.x) < precision
			&& fabs(newVelocity.y) < precision
			&& deltaTime > 0.0f)
		{
			velocity = Vector2();
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
		std::shared_ptr<struct Component> parent,
		std::function<struct Component*()> initialize)
	{
		for (int32_t i = 0; i < capacity; ++i)
		{
			auto component = std::shared_ptr<struct Component>(initialize());
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

struct RectangleComponent : DrawComponent
{
	RectangleComponent(std::vector<Entity>& entities, uint32_t rgba)
	: DrawComponent(entities)
	{
		addEntity(entities, Entity::rectangle(Vector2(), Vector2(), rgba));
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

struct FillCircleComponent : DrawComponent
{
	FillCircleComponent(std::vector<Entity>& entities, uint32_t rgba)
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
		//printf("FillCircleComponent cached %4.2f x %4.2f, %4.2f x %4.2f\n",
		//	cachedParentPosition.x, cachedParentPosition.y, cachedParentSize.x, cachedParentSize.y);
		Entity& circle = entities[getStartIndex(entities)+1];
		//circle.coord1 = Vector2(screenPosition.x - anchorPoint.x*radius*2.0f, screenPosition.y - anchorPoint.y*radius*2.0f);
		circle.coord1 = screenPosition;
		circle.coord3 = Vector2(screenSize.x/2.0f, screenSize.y/2.0f);
		//printf("FillCircleComponent doLayoutEntities %4.2f x %4.2f\n", screenPosition.x, screenPosition.y);
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

	void doLayoutEntities(
		std::vector<Entity>& entities,
		const Vector2& oldScreenPosition,
		const Vector2& oldScreenSize) override
	{
		Entity& textEntity = entities[getStartIndex(entities)+1];
		textEntity.coord1 = screenPosition;
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
		setEndIndex(entities, entities.size() - 1);
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

	void doStep(float timeDelta)
	{
		if (rootComponent)
		{
			rootComponent->doStep(entities, timeDelta);
		}
	}

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
};

struct Game
{
	Game()
	: count(0)
	, lastTime(emscripten_get_now())
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
		screen->doStep(currentTime-lastTime);
		draw(currentTime, count);
		
		lastTime = currentTime;
	}
};




